const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const router = express.Router();

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

function requireOrganiser(req, res, next) {
    if (req.headers['x-user-role'] !== 'organiser') {
        return res.status(403).json({ error: 'Organiser access required' });
    }
    next();
}

router.post(
    '/rounds/:id/papers',
    requireOrganiser,
    upload.fields([{ name: 'paper', maxCount: 1 }, { name: 'memo', maxCount: 1 }]),
    (req, res) => {
        const roundId = req.params.id;

        if (!req.files || !req.files.paper) {
            return res.status(400).json({ error: 'Paper file is required' });
        }

        const paperFile = req.files.paper[0];
        const memoFile = req.files.memo ? req.files.memo[0] : null;

        const paper = {
            id: crypto.randomUUID(),
            roundId,
            fileUrl: `/uploads/papers/${paperFile.filename}`,
            memoUrl: memoFile ? `/uploads/papers/${memoFile.filename}` : null,
            isArchived: false,
            uploadedAt: new Date().toISOString()
        };

        // TODO: once Person 1's DB/Round model exists, save this properly

        res.status(201).json(paper);
    }
);

module.exports = router;