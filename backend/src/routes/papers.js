const express = require('express');
const multer = require('multer');
const prisma = require('../lib/prisma');
const { requireAuth } = require('@clerk/express');
const { isOlympiadOrganiser } = require('../lib/authorization');

const router = express.Router();

const supabase = require('../lib/supabase');

//Keeping files in supaabase memeroy instead of locak disk
//uploading the buffer straight to supabase storage
const upload = multer({ storage: multer.memoryStorage() });

const BUCKET = process.env.SUPABASE_BUCKET_NAME;

async function uploadToSupabase(file) {
  const uniqueName = `${Date.now()}-${file.originalname}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(uniqueName, file.buffer, { contentType: file.mimetype });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(uniqueName);
  return data.publicUrl;
}

async function requireOrganiserRole(req, res, next) {
  const { userId: clerkUserId } = req.auth();
  const user = await prisma.user.findUnique({ where: { clerkUserId } });

  if (!user || user.role !== 'organiser') {
    return res.status(403).json({ error: 'Organiser access required' });
  }

  // Attach the user to the request for downstream checks.
  req.organiserUser = user;
  next();
}

// POST /rounds/:id/papers
router.post(
  '/rounds/:id/papers',
  requireAuth(),
  requireOrganiserRole,
  upload.fields([
    { name: 'paper', maxCount: 1 },
    { name: 'memo', maxCount: 1 },
  ]),
  async (req, res) => {
    const roundId = req.params.id;

    // Only organisers of this specific olympiad may upload papers.
    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }
    if (!(await isOlympiadOrganiser(req.organiserUser.id, round.olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    if (!req.files || !req.files.paper) {
      return res.status(400).json({ error: 'A paper file is required' });
    }

    const paperFile = req.files.paper[0];
    const memoFile = req.files.memo ? req.files.memo[0] : null;

    let memoAnswers = null;
    if (req.body.memoAnswers) {
      try {
        memoAnswers = JSON.parse(req.body.memoAnswers);
      } catch {
        return res.status(400).json({ error: 'memoAnswers must be valid JSON' });
      }
    }

    try {
      const fileUrl = await uploadToSupabase(paperFile);
      const memoUrl = memoFile ? await uploadToSupabase(memoFile) : null;

      // Upsert so an organiser can replace a previously uploaded paper
      const paper = await prisma.paper.upsert({
        where: { roundId },
        create: { roundId, fileUrl, memoUrl, memoAnswers },
        update: { fileUrl, memoUrl, memoAnswers },
      });
      res.status(201).json(paper);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not save paper record' });
    }
  }
);

// GET /rounds/:id/papers
router.get('/rounds/:id/papers', async (req, res) => {
  const roundId = req.params.id;

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { paper: true },
  });

  if (!round) {
    return res.status(404).json({ error: 'Round not found' });
  }

  const downloadable = round.state === 'open' || round.state === 'released';

  if (!downloadable) {
    return res.status(403).json({
      error: `Paper not available - round is currently '${round.state}'`,
    });
  }

  if (!round.paper) {
    return res.status(404).json({ error: 'No paper uploaded for this round yet' });
  }

  res.status(200).json(round.paper);
});

// GET /papers/archive
// Returns all papers from closed or released rounds — the past-paper archive
// accessible to both organisers and educators.
router.get('/papers/archive', async (req, res) => {
  try {
    const { olympiadId } = req.query;
    const where = {
      round: {
        state: { in: ['closed', 'released'] },
        ...(olympiadId ? { olympiadId } : {}),
      },
    };

    const papers = await prisma.paper.findMany({
      where,
      include: {
        round: {
          include: { olympiad: true },
        },
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    // Flatten into a simpler shape for the frontend archive list
    const archive = papers.map((p) => ({
      id: p.id,
      roundId: p.roundId,
      roundName: p.round.name,
      olympiadName: p.round.olympiad.name,
      closeTime: p.round.closeTime,
      fileUrl: p.fileUrl,
      memoUrl: p.memoUrl,
      uploadedAt: p.uploadedAt,
    }));

    res.json(archive);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch archived papers' });
  }
});

module.exports = router;
