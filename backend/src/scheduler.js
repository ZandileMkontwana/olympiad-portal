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

/**
 * When a round transitions from 'scheduled' to 'open', register all existing
 * entrants for it. This handles entrants that were created before the round
 * opened (the per-entrant auto-registration in entrants.js only fires at
 * creation time, so previously created entrants would be missed).
 */
async function registerEntrantsForNewlyOpenRounds() {
  const openRounds = await prisma.round.findMany({
    where: { state: 'open' },
    select: { id: true },
  });
  if (openRounds.length === 0) return;

  const entrants = await prisma.entrant.findMany({ select: { id: true } });
  if (entrants.length === 0) return;

  for (const round of openRounds) {
    const existing = await prisma.roundEntrant.findMany({
      where: { roundId: round.id },
      select: { entrantId: true },
    });
    const existingIds = new Set(existing.map((re) => re.entrantId));
    const toCreate = entrants
      .filter((e) => !existingIds.has(e.id))
      .map((e) => ({ roundId: round.id, entrantId: e.id }));

    if (toCreate.length > 0) {
      await prisma.roundEntrant.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }
  }
}

function startScheduler() {
  cron.schedule('*/30 * * * * *', async () => {
    const now = new Date();

    const opened = await prisma.round.updateMany({
      where: { state: 'scheduled', openTime: { lte: now } },
      data: { state: 'open' },
    });
    if (opened.count > 0) {
      console.log(`Opened ${opened.count} round(s) at ${now.toISOString()}`);
      // Register all existing entrants for newly opened rounds
      await registerEntrantsForNewlyOpenRounds();
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

// Same as roundIncludeForNotifications, plus each entrant's submissions —
// needed to spot which entrants haven't submitted yet.
const roundIncludeForMissingSubmissions = {
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
    include: roundIncludeForMissingSubmissions,
  });

  for (const round of recentlyClosedRounds) {
    if (!(await isTriggerEnabled(round.id, 'missing_submission'))) continue;

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

// getRecipientsForRound, isTriggerEnabled and the include shapes are exported
// so the notification dry-run route (routes/rounds.js) can reuse the exact
// same recipient + enablement logic the scheduler runs on.
module.exports = {
  startScheduler,
  getRecipientsForRound,
  isTriggerEnabled,
  roundIncludeForNotifications,
  roundIncludeForMissingSubmissions,
};
