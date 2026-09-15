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

    // Auto-advance is fully independent of the open/close step above: it
    // looks for any closed round with a qualifyingThreshold that hasn't
    // been processed yet (autoAdvanceProcessedAt is null), regardless of
    // which tick actually closed it. This keeps the original open/close
    // logic above completely untouched.
    await processAutoAdvance();
  });
  console.log('Round scheduler started — ticking every 30s');
}

// Finds closed rounds with a qualifyingThreshold that haven't been
// processed yet, and for each one, registers qualifying entrants into the
// next round in the same olympiad. "Next round" is inferred as the round
// with the earliest openTime after this one, since Round has no explicit
// ordering/sequence field of its own. Marking autoAdvanceProcessedAt keeps
// this idempotent across ticks - each round is only ever processed once,
// independent of exactly when or how it was closed.
async function processAutoAdvance() {
  const roundsToProcess = await prisma.round.findMany({
    where: {
      state: 'closed',
      qualifyingThreshold: { not: null },
      autoAdvanceProcessedAt: null,
    },
    include: {
      roundEntrants: {
        include: {
          entrant: {
            include: {
              submissions: { include: { result: true } },
            },
          },
        },
      },
    },
  });

  for (const round of roundsToProcess) {
    const nextRound = await prisma.round.findFirst({
      where: {
        olympiadId: round.olympiadId,
        openTime: { gt: round.openTime },
      },
      orderBy: { openTime: 'asc' },
    });

    if (nextRound) {
      for (const roundEntrant of round.roundEntrants) {
        const entrant = roundEntrant.entrant;
        const submission = entrant.submissions.find((s) => s.roundId === round.id);
        const score = submission?.result?.score;

        // Not marked yet (still in the marking queue, or a pending remark)
        // - skip for now. Since this round is now marked as processed
        // below, a late marking won't retroactively advance this entrant.
        if (score === undefined || score === null) continue;
        if (score < round.qualifyingThreshold) continue;

        const alreadyRegistered = await prisma.roundEntrant.findUnique({
          where: { roundId_entrantId: { roundId: nextRound.id, entrantId: entrant.id } },
        });

        if (!alreadyRegistered) {
          await prisma.roundEntrant.create({
            data: { roundId: nextRound.id, entrantId: entrant.id },
          });
        }
      }
    }

    await prisma.round.update({
      where: { id: round.id },
      data: { autoAdvanceProcessedAt: new Date() },
    });
  }
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
    for (const roundEntrant of round.roundEntrants) {
      const entrant = roundEntrant.entrant;
      const hasSubmitted = entrant.submissions.some((s) => s.roundId === round.id);

      if (hasSubmitted) continue;

      const recipientEmails = new Set(entrant.school.educators.map((e) => e.user.email));

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
