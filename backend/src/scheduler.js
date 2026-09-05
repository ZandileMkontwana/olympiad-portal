const cron = require('node-cron');
const prisma = require('./lib/prisma');
const {
  sendRoundClosingNotification,
  sendResultsReleasedNotification,
  sendMissingSubmissionNotification,
} = require('./lib/email');

const NOTIFY_BEFORE_CLOSE_MS = 60 * 60 * 1000; // 1 hour

function startScheduler() {
  cron.schedule('*/30 * * * * *', async () => {
    const now = new Date();

    const opened = await prisma.round.updateMany({
      where: { state: 'scheduled', openTime: { lte: now } },
      data: { state: 'open' },
    });
    if (opened.count > 0) {
      console.log(`Opened ${opened.count} round(s) at ${now.toISOString()}`);
    }

    const closed = await prisma.round.updateMany({
      where: { state: 'open', closeTime: { lte: now } },
      data: { state: 'closed' },
    });
    if (closed.count > 0) {
      console.log(`Closed ${closed.count} round(s) at ${now.toISOString()}`);
    }

    await sendBeforeCloseNotifications(now);
    await sendResultsReleasedNotifications(now);
    await sendMissingSubmissionNotifications(now);
  });
  console.log('Round scheduler started — ticking every 30s');
}

async function getRecipientsForRound(round) {
  const recipientEmails = new Set();
  for (const roundEntrant of round.roundEntrants) {
    for (const educator of roundEntrant.entrant.school.educators) {
      recipientEmails.add(educator.user.email);
    }
  }
  return recipientEmails;
}

const roundIncludeForNotifications = {
  roundEntrants: {
    include: {
      entrant: {
        include: {
          school: {
            include: {
              educators: { include: { user: true } },
            },
          },
        },
      },
    },
  },
};

async function sendBeforeCloseNotifications(now) {
  const windowEnd = new Date(now.getTime() + NOTIFY_BEFORE_CLOSE_MS);

  const closingSoonRounds = await prisma.round.findMany({
    where: { state: 'open', closeTime: { gte: now, lte: windowEnd } },
    include: roundIncludeForNotifications,
  });

  for (const round of closingSoonRounds) {
    const recipientEmails = await getRecipientsForRound(round);
    for (const email of recipientEmails) {
      const alreadyNotified = await prisma.notificationLog.findUnique({
        where: {
          roundId_triggerType_recipientEmail: {
            roundId: round.id,
            triggerType: 'before_close',
            recipientEmail: email,
          },
        },
      });
      if (!alreadyNotified) {
        await sendRoundClosingNotification({
          toEmail: email,
          roundId: round.id,
          roundName: round.name,
          closesAt: round.closeTime.toISOString(),
        });
      }
    }
  }
}

async function sendResultsReleasedNotifications(now) {
  // "Results released" = round is closed AND at least one Result in it
  // has a non-null releasedAt. We notify once per round, when we first
  // detect any released result for it.
  const roundsWithReleasedResults = await prisma.round.findMany({
    where: {
      state: 'closed',
      submissions: {
        some: { result: { releasedAt: { not: null } } },
      },
    },
    include: roundIncludeForNotifications,
  });

  for (const round of roundsWithReleasedResults) {
    const recipientEmails = await getRecipientsForRound(round);
    for (const email of recipientEmails) {
      const alreadyNotified = await prisma.notificationLog.findUnique({
        where: {
          roundId_triggerType_recipientEmail: {
            roundId: round.id,
            triggerType: 'results_released',
            recipientEmail: email,
          },
        },
      });
      if (!alreadyNotified) {
        await sendResultsReleasedNotification({
          toEmail: email,
          roundId: round.id,
          roundName: round.name,
        });
      }
    }
  }
}

async function sendMissingSubmissionNotifications(now) {
  const recentlyClosedRounds = await prisma.round.findMany({
    where: { state: 'closed' },
    include: {
      roundEntrants: {
        include: {
          entrant: {
            include: {
              school: { include: { educators: { include: { user: true } } } },
              submissions: true,
            },
          },
        },
      },
    },
  });

  for (const round of recentlyClosedRounds) {
    for (const roundEntrant of round.roundEntrants) {
      const entrant = roundEntrant.entrant;
      const hasSubmitted = entrant.submissions.some((s) => s.roundId === round.id);

      if (hasSubmitted) continue;

      const recipientEmails = new Set(
        entrant.school.educators.map((e) => e.user.email)
      );

      for (const email of recipientEmails) {
        const alreadyNotified = await prisma.notificationLog.findUnique({
          where: {
            roundId_triggerType_recipientEmail: {
              roundId: round.id,
              triggerType: 'missing_submission',
              recipientEmail: email,
            },
          },
        });

        if (!alreadyNotified) {
          await sendMissingSubmissionNotification({
            toEmail: email,
            roundId: round.id,
            roundName: round.name,
            entrantName: entrant.name,
            entrantId: entrant.id,
          });
        }
      }
    }
  }
}

module.exports = { startScheduler };