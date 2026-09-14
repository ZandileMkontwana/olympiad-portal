const cron = require('node-cron');
const prisma = require('./lib/prisma');
const {
  sendRoundOpeningNotification,
  sendRoundClosingNotification,
  sendResultsReleasedNotification,
  sendMissingSubmissionNotification,
} = require('./lib/email');

const NOTIFY_BEFORE_OPEN_MS = 60 * 60 * 1000; // 1 hour
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

    await sendBeforeOpenNotifications(now);
    await sendBeforeCloseNotifications(now);
    await sendResultsReleasedNotifications();
    await sendMissingSubmissionNotifications();
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

// Checks whether a given trigger type is enabled for a round. If no
// NotificationRule row exists for this (roundId, triggerType) pair, the
// notification is enabled by default — this preserves the previous
// always-on behavior for any round that hasn't been explicitly configured.
//
// NOTE: recipientRole ('educator' | 'organiser' | 'all') is stored on the
// rule but not yet used to filter recipients — there's currently no data
// model relationship identifying which organiser(s) own a given round, so
// organiser-targeted notifications aren't buildable yet. Every notification
// still goes to educators only, same as before this change (#136-#137).
async function isTriggerEnabled(roundId, triggerType) {
  const rule = await prisma.notificationRule.findUnique({
    where: { roundId_triggerType: { roundId, triggerType } },
  });
  return rule ? rule.enabled : true;
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

async function sendBeforeOpenNotifications(now) {
  const windowEnd = new Date(now.getTime() + NOTIFY_BEFORE_OPEN_MS);

  const upcomingRounds = await prisma.round.findMany({
    where: {
      state: 'scheduled',
      openTime: { gte: now, lte: windowEnd },
    },
    include: roundIncludeForNotifications,
  });

  for (const round of upcomingRounds) {
    if (!(await isTriggerEnabled(round.id, 'before_open'))) continue;

    const recipientEmails = await getRecipientsForRound(round);

    for (const email of recipientEmails) {
      const alreadyNotified = await prisma.notificationLog.findUnique({
        where: {
          roundId_triggerType_recipientEmail: {
            roundId: round.id,
            triggerType: 'before_open',
            recipientEmail: email,
          },
        },
      });

      if (!alreadyNotified) {
        await sendRoundOpeningNotification({
          toEmail: email,
          roundId: round.id,
          roundName: round.name,
          opensAt: round.openTime.toISOString(),
        });
      }
    }
  }
}

async function sendBeforeCloseNotifications(now) {
  const windowEnd = new Date(now.getTime() + NOTIFY_BEFORE_CLOSE_MS);

  const closingSoonRounds = await prisma.round.findMany({
    where: { state: 'open', closeTime: { gte: now, lte: windowEnd } },
    include: roundIncludeForNotifications,
  });

  for (const round of closingSoonRounds) {
    if (!(await isTriggerEnabled(round.id, 'before_close'))) continue;

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

async function sendResultsReleasedNotifications() {
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
    if (!(await isTriggerEnabled(round.id, 'results_released'))) continue;

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

async function sendMissingSubmissionNotifications() {
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
    if (!(await isTriggerEnabled(round.id, 'missing_submission'))) continue;

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