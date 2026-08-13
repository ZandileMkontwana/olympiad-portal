const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

function requireEducator(req, res, next) {
    if (req.headers['x-user-role'] !== 'educator') {
        return res.status(403).json({ error: 'Educator access required' });
    }
    next();
}

// POST /rounds/:id/submissions
router.post('/rounds/:id/submissions', requireEducator, async(req, res) => {
    const roundId = req.params.id;
    const { entrantId, answers, idempotencyKey } = req.body;

    if (!entrantId || !answers || !idempotencyKey) {
        return res.status(400).json({ error: 'entrantId, answers, and idempotencyKey are required' });
    }

    const round = await prisma.round.findUnique({
        where: { id: roundId },
        include: { paper: true }
    });

    if (!round) {
        return res.status(404).json({ error: 'Round not found' });
    }

    if (round.state !== 'open') {
        return res.status(403).json({
            error: `Submissions not accepted — round is currently '${round.state}'`
        });
    }

    try {
        const submission = await prisma.submission.create({
            data: { roundId, entrantId, answers, idempotencyKey }
        });

        // Automark immediately if this round's paper has a memo answer key
        let result = null;
        if (round.paper && round.paper.memoAnswers) {
            const memo = round.paper.memoAnswers;
            const totalQuestions = Object.keys(memo).length;
            let correctCount = 0;

            for (const questionId in memo) {
                if (answers[questionId] === memo[questionId]) {
                    correctCount++;
                }
            }

            const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

            result = await prisma.result.create({
                data: {
                    submissionId: submission.id,
                    score
                }
            });
        }

        res.status(201).json({ submission, result });
    } catch (err) {
        if (err.code === 'P2002' && err.meta && err.meta.target && err.meta.target.includes('idempotencyKey')) {
            const existing = await prisma.submission.findUnique({
                where: { idempotencyKey },
                include: { result: true }
            });
            return res.status(200).json({ submission: existing, result: existing.result });
        }
        console.error(err);
        res.status(500).json({ error: 'Could not save submission' });
    }
});

module.exports = router;