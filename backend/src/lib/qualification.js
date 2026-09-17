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
};
