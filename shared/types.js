/**
 * @typedef {Object} Round
 * @property {string} id
 * @property {string} olympiadId
 * @property {string} name
 * @property {string} openTime
 * @property {string} closeTime
 * @property {'scheduled'|'open'|'closed'|'released'} state
 */

/**
 * @typedef {Object} Submission
 * @property {string} id
 * @property {string} roundId
 * @property {string} entrantId
 * @property {string[]} answers
 * @property {string} submittedAt
 * @property {string} idempotencyKey
 */

module.exports = {};