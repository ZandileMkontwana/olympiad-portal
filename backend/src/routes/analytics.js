const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, loadAuthUser } = require('../middleware/auth');
const { isOlympiadOrganiser } = require('../lib/authorization');

const router = express.Router();

/**
 * GET /analytics/rounds/:roundId
 * Returns comprehensive analytics data for a round (organiser only)
 */
router.get('/analytics/rounds/:roundId', requireAuth, async (req, res) => {
  try {
    const user = await loadAuthUser(req);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const round = await prisma.round.findUnique({
      where: { id: req.params.roundId },
      include: {
        olympiad: true,
        paper: {
          include: {
            questions: {
              include: { variants: true },
              orderBy: { number: 'asc' },
            },
          },
        },
      },
    });

    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    // Check organiser access
    if (!(await isOlympiadOrganiser(user.id, round.olympiadId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Fetch all submissions for this round
    const submissions = await prisma.submission.findMany({
      where: { roundId: round.id },
      include: {
        result: true,
        entrant: {
          include: { school: true },
        },
        sitting: true,
      },
    });

    // Calculate analytics
    const analytics = calculateRoundAnalytics(submissions, round);

    res.json(analytics);
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /analytics/rounds/:roundId/schools/:schoolId
 * Returns analytics for a specific school in a round (educator or organiser)
 */
router.get('/analytics/rounds/:roundId/schools/:schoolId', requireAuth, async (req, res) => {
  try {
    const user = await loadAuthUser(req);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const round = await prisma.round.findUnique({
      where: { id: req.params.roundId },
      include: {
        olympiad: true,
        paper: {
          include: {
            questions: {
              include: { variants: true },
              orderBy: { number: 'asc' },
            },
          },
        },
      },
    });

    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }

    // Check access: organisers can see any school, educators only their own
    const isOrganiser = await isOlympiadOrganiser(user.id, round.olympiadId);
    if (!isOrganiser) {
      // Check if educator belongs to this school
      const educator = await prisma.educator.findUnique({
        where: { userId: user.id },
      });
      if (!educator || educator.schoolId !== req.params.schoolId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    // Fetch submissions for this school
    const submissions = await prisma.submission.findMany({
      where: {
        roundId: round.id,
        entrant: { schoolId: req.params.schoolId },
      },
      include: {
        result: true,
        entrant: {
          include: { school: true },
        },
        sitting: true,
      },
    });

    const analytics = calculateSchoolAnalytics(submissions, round);

    res.json(analytics);
  } catch (err) {
    console.error('School analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch school analytics' });
  }
});

/**
 * Calculate comprehensive analytics for a round
 */
function calculateRoundAnalytics(submissions, round) {
  const totalEntrants = submissions.length;
  const completedSubmissions = submissions.filter((s) => s.sitting?.completedAt);
  const completionRate = totalEntrants > 0 ? completedSubmissions.length / totalEntrants : 0;

  // Score distribution
  const scores = completedSubmissions
    .map((s) => s.result?.score)
    .filter((score) => score !== null && score !== undefined);

  const maxScore = round.paper.questions.reduce((sum, q) => sum + q.marks, 0);

  const scoreDistribution = buildScoreDistribution(scores, maxScore);

  // Submission timing
  const submissionTimes = completedSubmissions
    .map((s) => {
      const started = s.sitting?.startedAt;
      const completed = s.sitting?.completedAt;
      if (started && completed) {
        return (new Date(completed) - new Date(started)) / 1000 / 60; // minutes
      }
      return null;
    })
    .filter((t) => t !== null);

  const avgCompletionTime =
    submissionTimes.length > 0
      ? submissionTimes.reduce((sum, t) => sum + t, 0) / submissionTimes.length
      : 0;

  // Question-level analytics
  const questionAnalytics = calculateQuestionAnalytics(submissions, round.paper.questions);

  // School breakdown
  const schoolBreakdown = calculateSchoolBreakdown(submissions);

  return {
    round: {
      id: round.id,
      name: round.name,
      maxScore,
    },
    participation: {
      totalEntrants,
      completedSubmissions: completedSubmissions.length,
      completionRate,
    },
    scores: {
      average: scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0,
      median: calculateMedian(scores),
      min: scores.length > 0 ? Math.min(...scores) : 0,
      max: scores.length > 0 ? Math.max(...scores) : 0,
      distribution: scoreDistribution,
    },
    timing: {
      averageCompletionMinutes: avgCompletionTime,
      minCompletionMinutes: submissionTimes.length > 0 ? Math.min(...submissionTimes) : 0,
      maxCompletionMinutes: submissionTimes.length > 0 ? Math.max(...submissionTimes) : 0,
    },
    questions: questionAnalytics,
    schools: schoolBreakdown,
  };
}

/**
 * Calculate analytics for a specific school
 */
function calculateSchoolAnalytics(submissions, round) {
  const totalEntrants = submissions.length;
  const completedSubmissions = submissions.filter((s) => s.sitting?.completedAt);
  const completionRate = totalEntrants > 0 ? completedSubmissions.length / totalEntrants : 0;

  const scores = completedSubmissions
    .map((s) => s.result?.score)
    .filter((score) => score !== null && score !== undefined);

  const maxScore = round.paper.questions.reduce((sum, q) => sum + q.marks, 0);
  const scoreDistribution = buildScoreDistribution(scores, maxScore);

  const questionAnalytics = calculateQuestionAnalytics(submissions, round.paper.questions);

  return {
    round: {
      id: round.id,
      name: round.name,
      maxScore,
    },
    school: {
      id: submissions[0]?.entrant?.schoolId,
      name: submissions[0]?.entrant?.school?.name,
    },
    participation: {
      totalEntrants,
      completedSubmissions: completedSubmissions.length,
      completionRate,
    },
    scores: {
      average: scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0,
      median: calculateMedian(scores),
      min: scores.length > 0 ? Math.min(...scores) : 0,
      max: scores.length > 0 ? Math.max(...scores) : 0,
      distribution: scoreDistribution,
    },
    questions: questionAnalytics,
  };
}

/**
 * Build score distribution histogram
 */
function buildScoreDistribution(scores, maxScore) {
  if (scores.length === 0 || maxScore === 0) {
    return [];
  }

  // Create 10 bins (0-10%, 10-20%, ..., 90-100%)
  const binCount = 10;
  const binSize = maxScore / binCount;
  const bins = Array(binCount).fill(0);

  scores.forEach((score) => {
    const binIndex = Math.min(Math.floor(score / binSize), binCount - 1);
    bins[binIndex]++;
  });

  return bins.map((count, index) => ({
    range: `${Math.round(index * binSize)}-${Math.round((index + 1) * binSize)}`,
    percentage: Math.round((index / binCount) * 100),
    count,
  }));
}

/**
 * Calculate median of an array
 */
function calculateMedian(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate question-level analytics
 */
function calculateQuestionAnalytics(submissions, questions) {
  return questions.map((question) => {
    const questionScores = submissions
      .map((s) => {
        const result = s.result;
        if (!result) return null;

        // Try to extract question-specific score from breakdown
        // For now, use the overall score as a proxy
        // In a real implementation, you'd parse result.breakdown
        return result.score;
      })
      .filter((s) => s !== null);

    const avgScore =
      questionScores.length > 0
        ? questionScores.reduce((sum, s) => sum + s, 0) / questionScores.length
        : 0;

    return {
      id: question.id,
      number: question.number,
      text: question.text.substring(0, 100) + (question.text.length > 100 ? '...' : ''),
      maxMarks: question.marks,
      averageScore: avgScore,
      difficulty: question.difficulty,
    };
  });
}

/**
 * Calculate school-level breakdown
 */
function calculateSchoolBreakdown(submissions) {
  const schoolMap = new Map();

  submissions.forEach((s) => {
    const schoolId = s.entrant?.schoolId;
    const schoolName = s.entrant?.school?.name;

    if (!schoolId || !schoolName) return;

    if (!schoolMap.has(schoolId)) {
      schoolMap.set(schoolId, {
        id: schoolId,
        name: schoolName,
        entrants: 0,
        completed: 0,
        totalScore: 0,
      });
    }

    const school = schoolMap.get(schoolId);
    school.entrants++;

    if (s.sitting?.completedAt) {
      school.completed++;
      school.totalScore += s.result?.score || 0;
    }
  });

  return Array.from(schoolMap.values()).map((school) => ({
    ...school,
    averageScore: school.completed > 0 ? school.totalScore / school.completed : 0,
    completionRate: school.entrants > 0 ? school.completed / school.entrants : 0,
  }));
}

module.exports = router;
