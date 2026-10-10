import { describe, it, expect } from 'vitest';
import {
  speedAnomaly,
  identicalAnswers,
  submissionCluster,
  rapidSubmit,
  runAllSignals,
} from './signals.js';

describe('speedAnomaly', () => {
  const roundWindow = {
    openTime: '2026-03-01T08:00:00Z',
    closeTime: '2026-03-01T10:00:00Z', // 2 hours
  };

  it('returns empty when fewer than 3 sittings', () => {
    const sittings = [
      { entrantId: 'e1', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T08:10:00Z' },
      { entrantId: 'e2', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:30:00Z' },
    ];
    expect(speedAnomaly(sittings, roundWindow)).toEqual([]);
  });

  it('returns empty when round window is invalid', () => {
    const badWindow = { openTime: '2026-03-01T10:00:00Z', closeTime: '2026-03-01T08:00:00Z' };
    const sittings = [
      { entrantId: 'e1', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T08:10:00Z' },
      { entrantId: 'e2', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:00:00Z' },
      { entrantId: 'e3', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:30:00Z' },
    ];
    expect(speedAnomaly(sittings, badWindow)).toEqual([]);
  });

  it('flags a student who finished far below the cohort mean', () => {
    const sittings = [
      { entrantId: 'fast', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T08:05:00Z' }, // 5 min
      { entrantId: 'a', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:28:00Z' },   // 88 min
      { entrantId: 'b', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:30:00Z' },   // 90 min
      { entrantId: 'c', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:32:00Z' },   // 92 min
      { entrantId: 'd', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:30:00Z' },   // 90 min
      { entrantId: 'e', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:31:00Z' },   // 91 min
      { entrantId: 'f', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:29:00Z' },   // 89 min
      { entrantId: 'g', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:30:00Z' },   // 90 min
    ];
    const flags = speedAnomaly(sittings, roundWindow);
    expect(flags).toHaveLength(1);
    expect(flags[0].entrantIds).toEqual(['fast']);
    expect(flags[0].type).toBe('speed_anomaly');
    expect(flags[0].details.durationMinutes).toBe(5);
  });

  it('does not flag a fast student if they still used >25% of the window', () => {
    // 2-hour window, 25% = 30 min. A student who took 35 min shouldn't be flagged
    // even if they're the fastest.
    const sittings = [
      { entrantId: 'fast', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T08:35:00Z' }, // 35 min
      { entrantId: 'a', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:30:00Z' },
      { entrantId: 'b', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:35:00Z' },
      { entrantId: 'c', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:40:00Z' },
    ];
    const flags = speedAnomaly(sittings, roundWindow);
    expect(flags).toHaveLength(0);
  });

  it('assigns high severity when duration is <5% of window', () => {
    // 2-hour window, 5% = 6 min
    const sittings = [
      { entrantId: 'very-fast', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T08:05:00Z' }, // 5 min
      { entrantId: 'a', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:28:00Z' },
      { entrantId: 'b', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:30:00Z' },
      { entrantId: 'c', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:32:00Z' },
      { entrantId: 'd', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:30:00Z' },
      { entrantId: 'e', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:31:00Z' },
      { entrantId: 'f', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:29:00Z' },
      { entrantId: 'g', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:30:00Z' },
    ];
    const flags = speedAnomaly(sittings, roundWindow);
    expect(flags.length).toBeGreaterThanOrEqual(1);
    expect(flags[0].severity).toBe('high');
  });
});

describe('identicalAnswers', () => {
  const memo = { q1: 'A', q2: 'B', q3: 'C', q4: 'D', q5: 'A', q6: 'B', q7: 'C', q8: 'D', q9: 'A', q10: 'B' };

  it('returns empty when fewer than 2 submissions', () => {
    expect(identicalAnswers([{ entrantId: 'e1', answers: { q1: 'A' } }], memo)).toEqual([]);
  });

  it('returns empty when no memo is provided', () => {
    const subs = [
      { entrantId: 'e1', answers: { q1: 'A' } },
      { entrantId: 'e2', answers: { q1: 'A' } },
    ];
    expect(identicalAnswers(subs, null)).toEqual([]);
  });

  it('flags a pair with >90% agreement and 3+ identical wrong answers', () => {
    const subs = [
      { entrantId: 'e1', answers: { q1: 'X', q2: 'X', q3: 'X', q4: 'D', q5: 'A', q6: 'B', q7: 'C', q8: 'D', q9: 'A', q10: 'B' } },
      { entrantId: 'e2', answers: { q1: 'X', q2: 'X', q3: 'X', q4: 'D', q5: 'A', q6: 'B', q7: 'C', q8: 'D', q9: 'A', q10: 'B' } },
    ];
    // q1, q2, q3 are identical wrong answers (both answered X, correct is A/B/C)
    // q4-q10 are identical correct answers
    // Agreement: 10/10 = 100%, wrong matches: 3
    const flags = identicalAnswers(subs, memo);
    expect(flags).toHaveLength(1);
    expect(flags[0].entrantIds).toEqual(['e1', 'e2']);
    expect(flags[0].details.identicalWrongAnswers).toBe(3);
    expect(flags[0].details.agreement).toBe(1);
  });

  it('does not flag pairs with high agreement but no shared wrong answers', () => {
    const subs = [
      { entrantId: 'e1', answers: { q1: 'A', q2: 'B', q3: 'C', q4: 'D', q5: 'A', q6: 'B', q7: 'C', q8: 'D', q9: 'A', q10: 'B' } },
      { entrantId: 'e2', answers: { q1: 'A', q2: 'B', q3: 'C', q4: 'D', q5: 'A', q6: 'B', q7: 'C', q8: 'D', q9: 'A', q10: 'B' } },
    ];
    // 100% agreement but all correct — no wrong matches
    const flags = identicalAnswers(subs, memo);
    expect(flags).toHaveLength(0);
  });

  it('does not flag pairs with agreement below 90%', () => {
    const subs = [
      { entrantId: 'e1', answers: { q1: 'A', q2: 'B', q3: 'C', q4: 'D', q5: 'A', q6: 'B', q7: 'C', q8: 'X', q9: 'X', q10: 'X' } },
      { entrantId: 'e2', answers: { q1: 'A', q2: 'B', q3: 'C', q4: 'D', q5: 'A', q6: 'B', q7: 'C', q8: 'D', q9: 'A', q10: 'B' } },
    ];
    // 7/10 = 70% agreement — below threshold
    const flags = identicalAnswers(subs, memo);
    expect(flags).toHaveLength(0);
  });

  it('assigns high severity for near-perfect agreement with many wrong matches', () => {
    const subs = [
      { entrantId: 'e1', answers: { q1: 'X', q2: 'X', q3: 'X', q4: 'X', q5: 'X', q6: 'B', q7: 'C', q8: 'D', q9: 'A', q10: 'B' } },
      { entrantId: 'e2', answers: { q1: 'X', q2: 'X', q3: 'X', q4: 'X', q5: 'X', q6: 'B', q7: 'C', q8: 'D', q9: 'A', q10: 'B' } },
    ];
    // 100% agreement, 5 identical wrong answers
    const flags = identicalAnswers(subs, memo);
    expect(flags[0].severity).toBe('high');
  });

  it('only counts questions both students attempted', () => {
    const subs = [
      { entrantId: 'e1', answers: { q1: 'X', q2: 'X', q3: 'X', q4: 'D' } },
      { entrantId: 'e2', answers: { q1: 'X', q2: 'X', q3: 'X', q4: 'D' } },
    ];
    // Only 4 shared questions, all match, 3 wrong
    const flags = identicalAnswers(subs, memo);
    expect(flags).toHaveLength(1);
    expect(flags[0].details.sharedQuestions).toBe(4);
  });
});

describe('submissionCluster', () => {
  it('returns empty when fewer than 3 submissions', () => {
    const subs = [
      { entrantId: 'e1', submittedAt: '2026-03-01T09:59:00Z' },
      { entrantId: 'e2', submittedAt: '2026-03-01T09:59:30Z' },
    ];
    expect(submissionCluster(subs)).toEqual([]);
  });

  it('flags a cluster of 3 submissions within the default 120s window', () => {
    const subs = [
      { entrantId: 'e1', submittedAt: '2026-03-01T09:59:00Z' },
      { entrantId: 'e2', submittedAt: '2026-03-01T09:59:30Z' },
      { entrantId: 'e3', submittedAt: '2026-03-01T10:00:00Z' },
    ];
    const flags = submissionCluster(subs);
    expect(flags).toHaveLength(1);
    expect(flags[0].entrantIds).toEqual(['e1', 'e2', 'e3']);
    expect(flags[0].details.clusterSize).toBe(3);
    expect(flags[0].severity).toBe('low');
  });

  it('does not flag when submissions are spread beyond the window', () => {
    const subs = [
      { entrantId: 'e1', submittedAt: '2026-03-01T09:55:00Z' },
      { entrantId: 'e2', submittedAt: '2026-03-01T09:58:00Z' }, // 3 min gap
      { entrantId: 'e3', submittedAt: '2026-03-01T10:00:00Z' }, // 5 min from first
    ];
    const flags = submissionCluster(subs, 120);
    // e1→e3 span is 5 min > 120s, so no cluster of all 3
    expect(flags).toHaveLength(0);
  });

  it('assigns higher severity for larger clusters', () => {
    const subs = [
      { entrantId: 'e1', submittedAt: '2026-03-01T09:59:00Z' },
      { entrantId: 'e2', submittedAt: '2026-03-01T09:59:10Z' },
      { entrantId: 'e3', submittedAt: '2026-03-01T09:59:20Z' },
      { entrantId: 'e4', submittedAt: '2026-03-01T09:59:30Z' },
      { entrantId: 'e5', submittedAt: '2026-03-01T09:59:40Z' },
    ];
    const flags = submissionCluster(subs);
    expect(flags[0].severity).toBe('high');
    expect(flags[0].details.clusterSize).toBe(5);
  });

  it('respects a custom window size', () => {
    const subs = [
      { entrantId: 'e1', submittedAt: '2026-03-01T09:55:00Z' },
      { entrantId: 'e2', submittedAt: '2026-03-01T09:58:00Z' },
      { entrantId: 'e3', submittedAt: '2026-03-01T10:00:00Z' },
    ];
    // With a 5-minute window, all 3 should cluster
    const flags = submissionCluster(subs, 300);
    expect(flags).toHaveLength(1);
    expect(flags[0].details.clusterSize).toBe(3);
  });
});

describe('rapidSubmit', () => {
  it('flags a student who submitted in under 5 minutes', () => {
    const sittings = [
      { entrantId: 'e1', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T08:03:00Z' },
    ];
    const flags = rapidSubmit(sittings);
    expect(flags).toHaveLength(1);
    expect(flags[0].entrantIds).toEqual(['e1']);
    expect(flags[0].details.durationMinutes).toBe(3);
  });

  it('does not flag a student who took longer than the threshold', () => {
    const sittings = [
      { entrantId: 'e1', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T08:10:00Z' },
    ];
    const flags = rapidSubmit(sittings);
    expect(flags).toHaveLength(0);
  });

  it('assigns high severity for submissions under 1 minute', () => {
    const sittings = [
      { entrantId: 'e1', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T08:00:45Z' },
    ];
    const flags = rapidSubmit(sittings);
    expect(flags[0].severity).toBe('high');
  });

  it('assigns medium severity for submissions under 3 minutes', () => {
    const sittings = [
      { entrantId: 'e1', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T08:02:30Z' },
    ];
    const flags = rapidSubmit(sittings);
    expect(flags[0].severity).toBe('medium');
  });

  it('respects a custom threshold', () => {
    const sittings = [
      { entrantId: 'e1', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T08:08:00Z' },
    ];
    // Default 5-min threshold: not flagged
    expect(rapidSubmit(sittings)).toHaveLength(0);
    // Custom 10-min threshold: flagged
    expect(rapidSubmit(sittings, 10)).toHaveLength(1);
  });

  it('does not flag zero-duration sittings', () => {
    const sittings = [
      { entrantId: 'e1', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T08:00:00Z' },
    ];
    const flags = rapidSubmit(sittings);
    expect(flags).toHaveLength(0);
  });
});

describe('runAllSignals', () => {
  it('consolidates flags from all signals and sorts by severity', () => {
    const roundWindow = {
      openTime: '2026-03-01T08:00:00Z',
      closeTime: '2026-03-01T10:00:00Z',
    };
    const memo = { q1: 'A', q2: 'B', q3: 'C', q4: 'D', q5: 'A', q6: 'B', q7: 'C', q8: 'D', q9: 'A', q10: 'B' };

    const sittings = [
      { entrantId: 'fast', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T08:03:00Z' }, // 3 min — rapid + speed anomaly
      { entrantId: 'a', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:28:00Z' },
      { entrantId: 'b', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:30:00Z' },
      { entrantId: 'c', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:32:00Z' },
      { entrantId: 'd', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:30:00Z' },
      { entrantId: 'e', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:31:00Z' },
      { entrantId: 'f', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:29:00Z' },
      { entrantId: 'g', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:30:00Z' },
    ];
    const submissions = sittings.map((s) => ({
      entrantId: s.entrantId,
      answers: { q1: 'A', q2: 'B', q3: 'C', q4: 'D', q5: 'A', q6: 'B', q7: 'C', q8: 'D', q9: 'A', q10: 'B' },
    }));

    const flags = runAllSignals({ sittings, submissions, roundWindow, memoAnswers: memo });

    // Should have at least rapid_submit and speed_anomaly for 'fast'
    const types = flags.map((f) => f.type);
    expect(types).toContain('rapid_submit');
    expect(types).toContain('speed_anomaly');

    // High severity flags should come first
    for (let i = 1; i < flags.length; i++) {
      const prev = { high: 0, medium: 1, low: 2 }[flags[i - 1].severity];
      const curr = { high: 0, medium: 1, low: 2 }[flags[i].severity];
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('skips identicalAnswers when no memo is provided', () => {
    const roundWindow = {
      openTime: '2026-03-01T08:00:00Z',
      closeTime: '2026-03-01T10:00:00Z',
    };
    const sittings = [
      { entrantId: 'e1', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:00:00Z' },
      { entrantId: 'e2', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:05:00Z' },
      { entrantId: 'e3', startedAt: '2026-03-01T08:00:00Z', submittedAt: '2026-03-01T09:10:00Z' },
    ];
    const submissions = sittings.map((s) => ({
      entrantId: s.entrantId,
      answers: { q1: 'X', q2: 'X', q3: 'X', q4: 'D' },
    }));

    const flags = runAllSignals({ sittings, submissions, roundWindow });
    const types = flags.map((f) => f.type);
    expect(types).not.toContain('identical_answers');
  });
});
