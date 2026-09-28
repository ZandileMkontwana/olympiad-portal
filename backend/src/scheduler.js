const cron = require('node-cron');
const prisma = require('./lib/prisma');
const { getDbNow } = require('./lib/dbTime');
const {
  sendRoundOpeningNotification,
  sendRoundClosingNotification,
  sendResultsReleasedNotification,
  sendMissingSubmissionNotification,
} = require('./lib/email');
const {
  filterQualifiedEntrantIds,
  advanceQualifiedEntrantsForRound,
  AUTO_ADVANCE_ROUND_INCLUDE,
} = require('./lib/qualification');

const NOTIFY_BEFORE_OPEN_MS = 60 * 60 * 1000; // 1 hour
const NOTIFY_BEFORE_CLOSE_MS = 60 * 60 * 1000; // 1 hour

/**
 * When a round transitions from 'scheduled' to 'open', register all existing
 * entrants that meet the round's requirements for it. This handles entrants
 * that were created before the round opened (the per-entrant
 * auto-registration in entrants.js only fires at creation time, so
 * previously created entrants would be missed). Entrants who have not
 * passed the prerequisite round are never registered.
 */
async function registerEntrantsForNewlyOpenRounds() {
  const openRounds = await prisma.round.findMany({
    where: { state: 'open' },
    select: { id: true, olympiadId: true, prerequisiteRoundId: true, qualifyingThreshold: true },
  });
  if (openRounds.length === 0) return;

  for (const round of openRounds) {
    // Only register entrants from schools that have approved access to
    // this round's olympiad — prevents cross-olympiad leakage.
    const approvedSchools = await prisma.schoolOlympiad.findMany({
      where: { olympiadId: round.olympiadId, status: 'approved' },
      select: { schoolId: true },
    });
    const schoolIds = approvedSchools.map((s) => s.schoolId);
    if (schoolIds.length === 0) continue;

    const entrants = await prisma.entrant.findMany({
      where: { schoolId: { in: schoolIds } },
      select: { id: true },
    });
    if (entrants.length === 0) continue;

    const existing = await prisma.roundEntrant.findMany({
      where: { roundId: round.id },
      select: { entrantId: true },
    });
    const existingIds = new Set(existing.map((re) => re.entrantId));
    const candidateIds = entrants.filter((e) => !existingIds.has(e.id)).map((e) => e.id);

    // Qualification gate: only entrants who meet this round's requirements
    // are registered for it.
    const qualifiedIds = await filterQualifiedEntrantIds(candidateIds, round);
    const toCreate = qualifiedIds.map((entrantId) => ({ roundId: round.id, entrantId }));

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
    // Use the database's own clock, not this app server's local clock -
    // see lib/dbTime.js for why that distinction matters here.
    const now = await getDbNow();

    const opened = await prisma.round.updateMany({
      where: { state: 'scheduled', openTime: { lte: now } },
      data: { state: 'open' },
    });
    if (opened.count > 0) {
      console.log(`Opened ${opened.count} round(s) at ${now.toISOString()}`);
      // Write audit log entries for each newly opened round
      const justOpened = await prisma.round.findMany({
        where: { state: 'open', openTime: { lte: now } },
        select: { id: true },
      });
      await prisma.auditLog.createMany({
        data: justOpened.map((r) => ({
          action: 'round_opened',
          roundId: r.id,
          payload: { openedAt: now.toISOString() },
        })),
      });
      // Register all existing entrants for newly opened rounds
      await registerEntrantsForNewlyOpenRounds();
    }

    const closed = await prisma.round.updateMany({
      where: { state: 'open', closeTime: { lte: now } },
      data: { state: 'closed' },
    });
    if (closed.count > 0) {
      console.log(`Closed ${closed.count} round(s) at ${now.toISOString()}`);
      // Write audit log entries for each newly closed round
      const justClosed = await prisma.round.findMany({
        where: { state: 'closed', closeTime: { lte: now } },
        select: { id: true },
      });
      await prisma.auditLog.createMany({
        data: justClosed.map((r) => ({
          action: 'round_closed',
          roundId: r.id,
          payload: { closedAt: now.toISOString() },
        })),
      });
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

// Finds closed or released rounds with a qualifyingThreshold whose latest
// score change has not been processed yet, and advances qualifying entrants
// via the shared pass in lib/qualification.js. "Next round" is inferred as
// the round with the earliest openTime after this one, since Round has no
// explicit ordering/sequence field of its own.
//
// Approved appeals do NOT wait for this sweep: the review route runs the
// same pass immediately inside its transaction (routes/remark.js), which
// also removes the race where a tick could stamp autoAdvanceProcessedAt
// after the appeal cleared it and silently swallow the re-trigger. This
// periodic sweep is the safety net for late-scored rounds and anything the
// in-request re-run missed.
async function processAutoAdvance() {
  const roundsToProcess = await prisma.round.findMany({
    where: {
      state: { in: ['closed', 'released'] },
      qualifyingThreshold: { not: null },
      autoAdvanceProcessedAt: null,
    },
    include: AUTO_ADVANCE_ROUND_INCLUDE,
  });

  for (const round of roundsToProcess) {
    // Collect entrants before advance so we can audit-log them
    const _entrantsBefore = new Set(round.roundEntrants.map((re) => re.entrant.id));

    const registered = await advanceQualifiedEntrantsForRound(round);

    // Write audit log entries for each entrant that was auto-advanced
    if (registered > 0) {
      const nextRound = await prisma.round.findFirst({
        where: {
          olympiadId: round.olympiadId,
          openTime: { gt: round.openTime },
        },
        orderBy: { openTime: 'asc' },
      });
      if (nextRound) {
        const advancedEntrants = round.roundEntrants
          .map((re) => re.entrant)
          .filter((entrant) => {
            const submission = entrant.submissions.find((s) => s.roundId === round.id);
            const score = submission?.result?.score;
            return score !== undefined && score !== null && score >= round.qualifyingThreshold;
          });

        for (const entrant of advancedEntrants) {
          await prisma.auditLog.create({
            data: {
              action: 'auto_advanced',
              roundId: round.id,
              payload: {
                entrantId: entrant.id,
                entrantName: entrant.name,
                nextRoundId: nextRound.id,
                score: entrant.submissions.find((s) => s.roundId === round.id)?.result?.score,
              },
            },
          });
        }
      }
    }
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
        await prisma.auditLog.create({
          data: {
            action: 'notification_sent',
            roundId: round.id,
            payload: { triggerType: 'before_open', recipientEmail: email },
          },
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
        await prisma.auditLog.create({
          data: {
            action: 'notification_sent',
            roundId: round.id,
            payload: { triggerType: 'before_close', recipientEmail: email },
          },
        });
      }
    }
  }
}

async function sendResultsReleasedNotifications() {
  // "Results released" = at least one Result with a non-null releasedAt.
  // We notify once per round, when we first detect any released result for
  // it. Both 'closed' and 'released' states are matched: the release-results
  // route flips the round to 'released', while older rounds may still carry
  // releasedAt stamps from before that state existed.
  const roundsWithReleasedResults = await prisma.round.findMany({
    where: {
      state: { in: ['closed', 'released'] },
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
        await prisma.auditLog.create({
          data: {
            action: 'notification_sent',
            roundId: round.id,
            payload: { triggerType: 'results_released', recipientEmail: email },
          },
        });
      }
    }
  }
}

async function sendMissingSubmissionNotifications() {
  // Both 'closed' and 'released' rounds are scanned: a round whose results
  // were released quickly after closing still owes its missing-submission
  // emails, and the release state change must not skip them.
  const recentlyClosedRounds = await prisma.round.findMany({
    where: { state: { in: ['closed', 'released'] } },
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
          await prisma.auditLog.create({
            data: {
              action: 'notification_sent',
              roundId: round.id,
              payload: {
                triggerType: 'missing_submission',
                recipientEmail: email,
                entrantId: entrant.id,
              },
            },
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
