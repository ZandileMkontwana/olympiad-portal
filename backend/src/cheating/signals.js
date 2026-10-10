// Cheating signal detection algorithms.
//
// Each function is a pure computation over submission/sitting data — no
// database access, no side effects. The endpoint layer (task #20) is
// responsible for loading the data and calling these functions.
//
// Every signal returns an array of "flags":
//   { type, severity, entrantIds, details }
// where severity is 'low' | 'medium' | 'high'.

/**
 * Signal 1: Speed anomaly.
 *
 * Flags students whose sitting duration is far below the cohort mean —
 * specifically, more than 2 standard deviations below AND less than 25%
 * of the round window. Both conditions must hold: a student who finishes
 * quickly in a short round isn't suspicious, and a student who took 80%
 * of the window isn't suspicious even if they're the fastest in a slow
 * cohort.
 *
 * @param {Array<{entrantId: string, startedAt: string|Date, submittedAt: string|Date}>} sittings
 * @param {{openTime: string|Date, closeTime: string|Date}} roundWindow
 * @returns {Array<{type: string, severity: string, entrantIds: string[], details: object}>}
 */
function speedAnomaly(sittings, roundWindow) {
  if (sittings.length < 3) return [];

  const roundMs =
    new Date(roundWindow.closeTime).getTime() - new Date(roundWindow.openTime).getTime();
  if (roundMs <= 0) return [];

  const durations = sittings.map((s) => {
    const start = new Date(s.startedAt).getTime();
    const end = new Date(s.submittedAt).getTime();
    return { entrantId: s.entrantId, durationMs: end - start };
  });

  const times = durations.map((d) => d.durationMs);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
  const stddev = Math.sqrt(variance);

  const threshold = mean - 2 * stddev;
  const maxSuspiciousDuration = roundMs * 0.25;

  return durations
    .filter((d) => d.durationMs < threshold && d.durationMs < maxSuspiciousDuration)
    .map((d) => ({
      type: 'speed_anomaly',
      severity: d.durationMs < roundMs * 0.05 ? 'high' : 'medium',
      entrantIds: [d.entrantId],
      details: {
        durationMinutes: Math.round(d.durationMs / 60_000),
        cohortMeanMinutes: Math.round(mean / 60_000),
        cohortStddevMinutes: Math.round(stddev / 60_000),
        roundWindowMinutes: Math.round(roundMs / 60_000),
        percentOfWindow: Math.round((d.durationMs / roundMs) * 100),
      },
    }));
}

/**
 * Signal 2: Identical answers.
 *
 * Pairwise comparison of answer sets within a round. Computes two metrics
 * for each pair:
 *   - Overall agreement: fraction of questions where both gave the same
 *     answer (only counting questions both attempted).
 *   - Wrong-answer overlap: fraction of wrong answers they share. This is
 *     the stronger signal — two students getting the same right answers
 *     is expected if they both studied; getting the same WRONG answers
 *     suggests copying.
 *
 * Flags pairs where overall agreement > 90% AND they share at least 3
 * identical wrong answers.
 *
 * @param {Array<{entrantId: string, answers: Record<string, string>}>} submissions
 * @param {Record<string, string>} memoAnswers - the answer key
 * @returns {Array<{type: string, severity: string, entrantIds: string[], details: object}>}
 */
function identicalAnswers(submissions, memoAnswers) {
  if (!memoAnswers || submissions.length < 2) return [];

  const flags = [];
  const questionIds = Object.keys(memoAnswers);

  for (let i = 0; i < submissions.length; i++) {
    for (let j = i + 1; j < submissions.length; j++) {
      const a = submissions[i];
      const b = submissions[j];
      if (!a.answers || !b.answers) continue;

      // Find questions both students attempted
      const shared = questionIds.filter((q) => a.answers[q] != null && b.answers[q] != null);
      if (shared.length === 0) continue;

      // Overall agreement
      const matching = shared.filter((q) => a.answers[q] === b.answers[q]);
      const agreement = matching.length / shared.length;

      // Wrong-answer overlap: questions where both gave the same wrong answer
      const wrongMatches = shared.filter(
        (q) =>
          a.answers[q] === b.answers[q] &&
          a.answers[q] !== memoAnswers[q]
      );

      if (agreement >= 0.9 && wrongMatches.length >= 3) {
        const severity =
          agreement >= 0.98 && wrongMatches.length >= 5
            ? 'high'
            : agreement >= 0.95
              ? 'medium'
              : 'low';

        flags.push({
          type: 'identical_answers',
          severity,
          entrantIds: [a.entrantId, b.entrantId],
          details: {
            agreement: Math.round(agreement * 1000) / 1000,
            sharedQuestions: shared.length,
            matchingAnswers: matching.length,
            identicalWrongAnswers: wrongMatches.length,
          },
        });
      }
    }
  }

  return flags;
}

/**
 * Signal 3: Submission time clustering.
 *
 * Detects groups of students who submitted within a narrow time window
 * of each other (default: 120 seconds). Clusters of 3+ are flagged —
 * two students submitting close together can happen by coincidence, but
 * three or more is more suspicious (e.g., one student sharing answers
 * with multiple others just before the deadline).
 *
 * @param {Array<{entrantId: string, submittedAt: string|Date}>} submissions
 * @param {number} [windowSeconds=120] - clustering window in seconds
 * @returns {Array<{type: string, severity: string, entrantIds: string[], details: object}>}
 */
function submissionCluster(submissions, windowSeconds = 120) {
  if (submissions.length < 3) return [];

  const windowMs = windowSeconds * 1000;
  const sorted = submissions
    .map((s) => ({
      entrantId: s.entrantId,
      time: new Date(s.submittedAt).getTime(),
    }))
    .sort((a, b) => a.time - b.time);

  // Sliding window: find maximal clusters where all submissions are
  // within `windowMs` of the first submission in the cluster.
  const clusters = [];
  let start = 0;

  for (let end = 0; end < sorted.length; end++) {
    while (sorted[end].time - sorted[start].time > windowMs) {
      start++;
    }
    const clusterSize = end - start + 1;
    if (clusterSize >= 3) {
      // Only record the cluster when we're at the last member
      // (or when the next element falls outside the window)
      const nextOutside =
        end === sorted.length - 1 || sorted[end + 1].time - sorted[start].time > windowMs;
      if (nextOutside) {
        const members = sorted.slice(start, end + 1);
        const span = members[members.length - 1].time - members[0].time;
        clusters.push({
          type: 'submission_cluster',
          severity: members.length >= 5 ? 'high' : members.length >= 4 ? 'medium' : 'low',
          entrantIds: members.map((m) => m.entrantId),
          details: {
            clusterSize: members.length,
            spanSeconds: Math.round(span / 1000),
            windowSeconds,
          },
        });
      }
    }
  }

  return clusters;
}

/**
 * Signal 4: Rapid submission.
 *
 * Flags students who submitted extremely quickly after starting — under
 * an absolute threshold (default: 5 minutes) regardless of cohort. This
 * catches cases where a student may have had pre-prepared answers and
 * just typed them in. Unlike speed_anomaly, this doesn't depend on the
 * cohort distribution.
 *
 * @param {Array<{entrantId: string, startedAt: string|Date, submittedAt: string|Date}>} sittings
 * @param {number} [thresholdMinutes=5]
 * @returns {Array<{type: string, severity: string, entrantIds: string[], details: object}>}
 */
function rapidSubmit(sittings, thresholdMinutes = 5) {
  const thresholdMs = thresholdMinutes * 60_000;

  return sittings
    .filter((s) => {
      const duration = new Date(s.submittedAt).getTime() - new Date(s.startedAt).getTime();
      return duration > 0 && duration < thresholdMs;
    })
    .map((s) => {
      const durationMs = new Date(s.submittedAt).getTime() - new Date(s.startedAt).getTime();
      const durationMinutes = Math.round(durationMs / 60_000);

      return {
        type: 'rapid_submit',
        severity: durationMs < 60_000 ? 'high' : durationMs < 180_000 ? 'medium' : 'low',
        entrantIds: [s.entrantId],
        details: {
          durationMinutes,
          durationSeconds: Math.round(durationMs / 1000),
          thresholdMinutes,
        },
      };
    });
}

/**
 * Runs all signals and returns a consolidated list of flags, sorted by
 * severity (high → medium → low).
 *
 * @param {{
 *   sittings: Array<{entrantId: string, startedAt: string, submittedAt: string}>,
 *   submissions: Array<{entrantId: string, answers: Record<string, string>}>,
 *   roundWindow: {openTime: string, closeTime: string},
 *   memoAnswers?: Record<string, string>,
 * }} data
 * @returns {Array<{type: string, severity: string, entrantIds: string[], details: object}>}
 */
function runAllSignals(data) {
  const { sittings, submissions, roundWindow, memoAnswers } = data;

  const flags = [
    ...speedAnomaly(sittings, roundWindow),
    ...(memoAnswers ? identicalAnswers(submissions, memoAnswers) : []),
    ...submissionCluster(submissions),
    ...rapidSubmit(sittings),
  ];

  const severityOrder = { high: 0, medium: 1, low: 2 };
  flags.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return flags;
}

module.exports = { speedAnomaly, identicalAnswers, submissionCluster, rapidSubmit, runAllSignals };
