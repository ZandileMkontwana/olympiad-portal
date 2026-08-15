const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/papers');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${file.originalname}`;
        cb(null, unique);
    }
});

const upload = multer({ storage });

// POST /rounds/:id/papers
router.post(
    '/rounds/:id/papers',
    ...requireRole('organiser'),
    upload.fields([{ name: 'paper', maxCount: 1 }, { name: 'memo', maxCount: 1 }]),
    async(req, res) => {
        const roundId = req.params.id;

        if (!req.files || !req.files.paper || !req.files.memo) {
            return res.status(400).json({ error: 'Both paper and memo files are required' });
        }

        const paperFile = req.files.paper[0];
        const memoFile = req.files.memo[0];

        let memoAnswers = null;
        if (req.body.memoAnswers) {
            try {
                memoAnswers = JSON.parse(req.body.memoAnswers);
            } catch (err) {
                return res.status(400).json({ error: 'memoAnswers must be valid JSON' });
            }
        }

        try {
            const paper = await prisma.paper.create({
                data: {
                    roundId,
                    fileUrl: `/uploads/papers/${paperFile.filename}`,
                    memoUrl: `/uploads/papers/${memoFile.filename}`,
                    memoAnswers
                }
            });
            res.status(201).json(paper);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Could not save paper record' });
        }
    }
);

// GET /rounds/:id/papers
router.get('/rounds/:id/papers', async(req, res) => {
    const roundId = req.params.id;

    const round = await prisma.round.findUnique({
        where: { id: roundId },
        include: { paper: true }
    });

    if (!round) {
        return res.status(404).json({ error: 'Round not found' });
    }

    const downloadable = round.state === 'open' || round.state === 'released';

    if (!downloadable) {
        return res.status(403).json({
            error: `Paper not available — round is currently '${round.state}'`
        });
    }

    if (!round.paper) {
        return res.status(404).json({ error: 'No paper uploaded for this round yet' });
    }

    res.status(200).json(round.paper);
});

module.exports = router;