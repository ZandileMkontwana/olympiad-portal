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

    const round = await prisma.round.findUnique({ where: { id: roundId } });

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
            data: {
                roundId,
                entrantId,
                answers,
                idempotencyKey
            }
        });
        res.status(201).json(submission);
    } catch (err) {
        if (err.code === 'P2002' && err.meta && err.meta.target && err.meta.target.includes('idempotencyKey')) {
            const existing = await prisma.submission.findUnique({ where: { idempotencyKey } });
            return res.status(200).json(existing);
        }
        console.error(err);
        res.status(500).json({ error: 'Could not save submission' });
    }
});

module.exports = router;