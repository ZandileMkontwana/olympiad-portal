const prisma = require('./prisma');

/**
 * Central prerequisite gate for rounds. A round with a prerequisiteRoundId
 * may only be entered by entrants who passed that prerequisite: a marked
 * submission (result present) scoring at least the round's
 * qualifyingThreshold. A null qualifyingThreshold means the prerequisite
 * only has to be completed. Rounds without a prerequisite are open to all.
 */

/**
 * Effective minimum score (0-100) required in the prerequisite round.
 */
function thresholdFor(round) {
  return round.qualifyingThreshold ?? 0;
}

/**
 * Checks whether an entrant meets a round's entry requirements.
 */
async function hasQualifiedForRound(entrantId, round) {
  if (!round || !round.prerequisiteRoundId) return true;

  const qualifyingSubmission = await prisma.submission.findFirst({
    where: {
      entrantId,
      roundId: round.prerequisiteRoundId,
      result: { is: { score: { gte: thresholdFor(round) } } },
    },
    select: { id: true },
  });

  return !!qualifyingSubmission;
}

/**
 * Batch version of hasQualifiedForRound for auto-registration paths: given
 * candidate entrant ids, returns only those that meet the round's
 * requirements.
 */
async function filterQualifiedEntrantIds(entrantIds, round) {
  if (!round || !round.prerequisiteRoundId || entrantIds.length === 0) {
    return entrantIds;
  }

  const qualifying = await prisma.submission.findMany({
    where: {
      entrantId: { in: entrantIds },
      roundId: round.prerequisiteRoundId,
      result: { is: { score: { gte: thresholdFor(round) } } },
    },
    select: { entrantId: true },
    distinct: ['entrantId'],
  });

  return qualifying.map((s) => s.entrantId);
}

/**
 * Prisma include shape for a round being checked for auto-advance: every
 * registered entrant with their current-round result. Shared by the
 * scheduler sweep and the appeal-review route so both read the same data.
 */
const AUTO_ADVANCE_ROUND_INCLUDE = {
  roundEntrants: {
    include: {
      entrant: {
        include: {
          submissions: { include: { result: true } },
        },
      },
    },
  },
};

/**
 * Registers every entrant of a finished round who meets its
 * qualifyingThreshold for the immediate next round in the olympiad, then
 * stamps the round as processed.
 *
 * Shared by the scheduler (periodic sweep over unprocessed closed/released
 * rounds) and the appeal-review route (immediate, in-transaction re-run
 * after an approved appeal revises a score), so a revision can never be
 * lost to scheduler tick timing.
 *
 * Safety properties:
 * - Only closed/released rounds with a threshold are processed; a round
 *   still open is left for the scheduler sweep after it closes.
 * - Registrations are add-only and idempotent: the unique
 *   (roundId, entrantId) constraint plus skipDuplicates make repeated or
 *   concurrent passes safe, and a lowered score never unseats an entrant
 *   who was already advanced.
 * - An entrant is never backfilled into a next round that has already
 *   ended; that exceptional late appeal is handled by the organiser.
 *
 * Returns the number of entrants queued for registration by this pass.
 */
async function advanceQualifiedEntrantsForRound(round, db = prisma) {
  if (!round) return 0;
  if (round.qualifyingThreshold === null || round.qualifyingThreshold === undefined) return 0;
  if (!['closed', 'released'].includes(round.state)) return 0;

  const nextRound = await db.round.findFirst({
    where: {
      olympiadId: round.olympiadId,
      openTime: { gt: round.openTime },
    },
    orderBy: { openTime: 'asc' },
  });

  let registered = 0;

  // Do not backfill a participant into a round that has already ended, or
  // skip it to advance the entrant further ahead. The organiser can handle
  // that exceptional late appeal manually.
  if (nextRound && ['scheduled', 'open'].includes(nextRound.state)) {
    const registrations = [];

    for (const roundEntrant of round.roundEntrants) {
      const entrant = roundEntrant.entrant;
      const submission = entrant.submissions.find((s) => s.roundId === round.id);
      const score = submission?.result?.score;

      if (score === undefined || score === null) continue;
      if (score < round.qualifyingThreshold) continue;

      registrations.push({ roundId: nextRound.id, entrantId: entrant.id });
    }

    if (registrations.length > 0) {
      await db.roundEntrant.createMany({
        data: registrations,
        skipDuplicates: true,
      });
      registered = registrations.length;
    }
  }

  await db.round.update({
    where: { id: round.id },
    data: { autoAdvanceProcessedAt: new Date() },
  });

  return registered;
}

/**
 * Human-readable reason a round's requirements are not met, used in 403
 * responses. Assumes the round has a prerequisite; rounds include the
 * prerequisiteRound relation so its name can be shown.
 */
function prerequisiteFailureMessage(round) {
  const prereqName = round.prerequisiteRound?.name ?? 'the previous round';
  return round.qualifyingThreshold
    ? `Requires at least ${round.qualifyingThreshold}% in ${prereqName}`
    : `Requires completion of ${prereqName}`;
}

module.exports = {
  hasQualifiedForRound,
  filterQualifiedEntrantIds,
  prerequisiteFailureMessage,
  AUTO_ADVANCE_ROUND_INCLUDE,
  advanceQualifiedEntrantsForRound,
};
