/**
 * Variant assignment algorithm.
 *
 * Assigns a question variant to an entrant using a hash-based approach.
 * This ensures:
 * - Deterministic assignment: the same entrant always gets the same variant
 * - Even distribution: variants are distributed uniformly across entrants
 * - No state required: no need to store assignments in the database
 *
 * The algorithm hashes the entrant ID and uses modulo to select a variant,
 * which provides a uniform distribution without requiring coordination.
 */

/**
 * Simple hash function for strings (djb2 algorithm).
 * Returns a 32-bit unsigned integer hash.
 *
 * @param {string} str - The string to hash
 * @returns {number} 32-bit unsigned integer hash
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Assigns a variant to an entrant for a given question.
 *
 * Uses a hash of the entrant ID combined with the question ID to ensure
 * that the same entrant gets the same variant for a question, but may
 * get different variants for different questions.
 *
 * @param {string} entrantId - The entrant's unique identifier
 * @param {string} questionId - The question's unique identifier
 * @param {Array<{id: string, label: string}>} variants - Array of variant objects
 * @returns {{id: string, label: string}|null} The assigned variant, or null if no variants
 */
function assignVariant(entrantId, questionId, variants) {
  if (!variants || variants.length === 0) {
    return null;
  }

  if (variants.length === 1) {
    return variants[0];
  }

  // Combine entrant ID and question ID for the hash
  // This ensures the same entrant gets the same variant for a question,
  // but may get different variants for different questions
  const combined = `${entrantId}:${questionId}`;
  const hash = hashString(combined);

  // Use modulo to select a variant
  const index = hash % variants.length;
  return variants[index];
}

/**
 * Assigns variants for all questions in a paper to an entrant.
 *
 * @param {string} entrantId - The entrant's unique identifier
 * @param {Array<{id: string, variants: Array}>} questions - Array of questions with variants
 * @returns {Map<string, {id: string, label: string}|null>} Map of questionId to assigned variant
 */
function assignVariantsForPaper(entrantId, questions) {
  const assignments = new Map();

  for (const question of questions) {
    const variant = assignVariant(entrantId, question.id, question.variants);
    assignments.set(question.id, variant);
  }

  return assignments;
}

/**
 * Verifies that variant assignments are evenly distributed.
 * Useful for testing and monitoring.
 *
 * @param {string[]} entrantIds - Array of entrant IDs
 * @param {string} questionId - The question ID
 * @param {Array<{id: string, label: string}>} variants - Array of variants
 * @returns {Map<string, number>} Map of variant label to count
 */
function getVariantDistribution(entrantIds, questionId, variants) {
  const counts = new Map();

  // Initialize counts
  for (const variant of variants) {
    counts.set(variant.label, 0);
  }

  // Count assignments
  for (const entrantId of entrantIds) {
    const variant = assignVariant(entrantId, questionId, variants);
    if (variant) {
      counts.set(variant.label, counts.get(variant.label) + 1);
    }
  }

  return counts;
}

module.exports = {
  assignVariant,
  assignVariantsForPaper,
  getVariantDistribution,
};
