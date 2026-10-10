/**
 * Difficulty calculation for questions.
 *
 * Calculates question difficulty as the success rate: the ratio of marks
 * earned to marks possible across all submissions for a round.
 *
 * Difficulty = total marks earned / total marks possible
 * - 1.0 = everyone got full marks (very easy)
 * - 0.0 = no one got any marks (very hard)
 * - null = no submissions yet
 *
 * This uses the variant-aware marking logic: each submission is marked
 * against the variant that was assigned to it, using the same resolution
 * order as automarking (variant memo -> base question memo -> skip).
 */

const prisma = require('../lib/prisma');

/**
 * Calculates difficulty for all questions in a paper based on submissions
 * for a specific round.
 *
 * @param {string} roundId - The round to calculate difficulty for
 * @returns {Promise<Map<string, number|null>>} Map of questionId to difficulty (0.0-1.0 or null)
 */
async function calculateDifficultyForRound(roundId) {
  // Fetch all submissions for this round with their answers
  const submissions = await prisma.submission.findMany({
    where: { roundId },
  });

  if (submissions.length === 0) {
    return new Map();
  }

  // Submission has no Prisma relation to Sitting — each entrant's variant
  // assignment lives on the sitting for the same roundId+entrantId, so it is
  // fetched separately and keyed by entrantId for the lookups below.
  const sittings = await prisma.sitting.findMany({
    where: { roundId },
    select: { entrantId: true, variantChoices: true },
  });
  const variantChoicesByEntrant = new Map(sittings.map((s) => [s.entrantId, s.variantChoices]));

  // Fetch the paper's questions with their variants
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      paper: {
        include: {
          questions: {
            include: { variants: true },
          },
        },
      },
    },
  });

  if (!round || !round.paper) {
    return new Map();
  }

  const questions = round.paper.questions;
  const difficultyMap = new Map();

  // Initialize accumulators for each question
  const questionStats = new Map();
  for (const question of questions) {
    questionStats.set(question.id, {
      totalEarned: 0,
      totalPossible: 0,
    });
  }

  // Process each submission
  for (const submission of submissions) {
    const answers = submission.answers || {};
    const variantChoices = variantChoicesByEntrant.get(submission.entrantId) || {};

    // Mark each question for this submission
    for (const question of questions) {
      const stats = questionStats.get(question.id);

      // Determine which memo answer to use (variant-aware)
      const assignedVariantId = variantChoices[question.id];
      const assignedVariant = assignedVariantId
        ? question.variants.find((v) => v.id === assignedVariantId)
        : null;

      const correctAnswer = assignedVariant?.memoAnswer || question.memoAnswer;

      // If there's a memo answer, we can mark this question
      if (correctAnswer) {
        stats.totalPossible += question.marks;

        // Check if the answer matches (exact string match for now)
        const studentAnswer = answers[question.id];
        if (studentAnswer === correctAnswer) {
          stats.totalEarned += question.marks;
        }
      }
      // If no memo answer, we can't mark this question, so skip it
    }
  }

  // Calculate difficulty for each question
  for (const question of questions) {
    const stats = questionStats.get(question.id);

    if (stats.totalPossible > 0) {
      const difficulty = stats.totalEarned / stats.totalPossible;
      difficultyMap.set(question.id, difficulty);
    } else {
      // No markable questions (no memo answers), so difficulty is null
      difficultyMap.set(question.id, null);
    }
  }

  return difficultyMap;
}

/**
 * Updates the difficulty field for all questions in a paper based on
 * submissions for a specific round.
 *
 * @param {string} roundId - The round to calculate difficulty from
 * @returns {Promise<number>} Number of questions updated
 */
async function updateQuestionDifficulty(roundId) {
  const difficultyMap = await calculateDifficultyForRound(roundId);

  if (difficultyMap.size === 0) {
    return 0;
  }

  // Update each question's difficulty
  let updateCount = 0;
  for (const [questionId, difficulty] of difficultyMap.entries()) {
    await prisma.question.update({
      where: { id: questionId },
      data: { difficulty },
    });
    updateCount++;
  }

  return updateCount;
}

module.exports = {
  calculateDifficultyForRound,
  updateQuestionDifficulty,
};
