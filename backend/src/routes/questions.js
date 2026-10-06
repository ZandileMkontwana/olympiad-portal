const express = require('express');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');
const { isOlympiadOrganiser } = require('../lib/authorization');

const router = express.Router();

const QUESTION_TYPES = ['multiple_choice', 'short_answer', 'essay', 'numeric'];

// GET /papers/:paperId/questions
// List all questions for a paper, ordered by question number
router.get('/papers/:paperId/questions', async (req, res) => {
  try {
    const paper = await prisma.paper.findUnique({
      where: { id: req.params.paperId },
      include: { round: { include: { olympiad: true } } },
    });
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    // Only organisers of this olympiad can view questions
    if (!(await isOlympiadOrganiser(req.user?.id, paper.round.olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    const questions = await prisma.question.findMany({
      where: { paperId: req.params.paperId },
      include: { variants: true },
      orderBy: { number: 'asc' },
    });

    res.json(questions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// POST /papers/:paperId/questions
// Create a new question for a paper
router.post('/papers/:paperId/questions', ...requireRole('organiser'), async (req, res) => {
  try {
    const { number, text, type, marks, memoAnswer, options, rubric } = req.body;

    // Validate required fields
    if (number === undefined || !text || !type || marks === undefined) {
      return res.status(400).json({
        error: 'number, text, type, and marks are required',
      });
    }

    // Validate question type
    if (!QUESTION_TYPES.includes(type)) {
      return res.status(400).json({
        error: `type must be one of: ${QUESTION_TYPES.join(', ')}`,
      });
    }

    // Validate marks
    if (typeof marks !== 'number' || marks < 0) {
      return res.status(400).json({
        error: 'marks must be a non-negative number',
      });
    }

    // Validate question number
    if (typeof number !== 'number' || number < 1) {
      return res.status(400).json({
        error: 'number must be a positive integer',
      });
    }

    // Verify paper exists and check authorization
    const paper = await prisma.paper.findUnique({
      where: { id: req.params.paperId },
      include: { round: { include: { olympiad: true } } },
    });
    if (!paper) {
      return res.status(404).json({ error: 'Paper not found' });
    }

    if (!(await isOlympiadOrganiser(req.user.id, paper.round.olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    // Check if question number already exists for this paper
    const existing = await prisma.question.findUnique({
      where: { paperId_number: { paperId: req.params.paperId, number } },
    });
    if (existing) {
      return res.status(409).json({
        error: `Question number ${number} already exists for this paper`,
      });
    }

    const question = await prisma.question.create({
      data: {
        paperId: req.params.paperId,
        number,
        text,
        type,
        marks,
        memoAnswer: memoAnswer || null,
        options: options || null,
        rubric: rubric || null,
      },
      include: { variants: true },
    });

    res.status(201).json(question);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// GET /questions/:id
// Get a single question with its variants
router.get('/questions/:id', async (req, res) => {
  try {
    const question = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: {
        variants: true,
        paper: { include: { round: { include: { olympiad: true } } } },
      },
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Only organisers of this olympiad can view questions
    if (!(await isOlympiadOrganiser(req.user?.id, question.paper.round.olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    res.json(question);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch question' });
  }
});

// PUT /questions/:id
// Update a question
router.put('/questions/:id', ...requireRole('organiser'), async (req, res) => {
  try {
    const { number, text, type, marks, memoAnswer, options, rubric } = req.body;

    // Validate question type if provided
    if (type !== undefined && !QUESTION_TYPES.includes(type)) {
      return res.status(400).json({
        error: `type must be one of: ${QUESTION_TYPES.join(', ')}`,
      });
    }

    // Validate marks if provided
    if (marks !== undefined && (typeof marks !== 'number' || marks < 0)) {
      return res.status(400).json({
        error: 'marks must be a non-negative number',
      });
    }

    // Validate question number if provided
    if (number !== undefined && (typeof number !== 'number' || number < 1)) {
      return res.status(400).json({
        error: 'number must be a positive integer',
      });
    }

    // Verify question exists and check authorization
    const existing = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: { paper: { include: { round: { include: { olympiad: true } } } } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (!(await isOlympiadOrganiser(req.user.id, existing.paper.round.olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    // Check if new question number conflicts with existing questions
    if (number !== undefined && number !== existing.number) {
      const conflict = await prisma.question.findUnique({
        where: {
          paperId_number: { paperId: existing.paperId, number },
        },
      });
      if (conflict) {
        return res.status(409).json({
          error: `Question number ${number} already exists for this paper`,
        });
      }
    }

    const question = await prisma.question.update({
      where: { id: req.params.id },
      data: {
        ...(number !== undefined && { number }),
        ...(text !== undefined && { text }),
        ...(type !== undefined && { type }),
        ...(marks !== undefined && { marks }),
        ...(memoAnswer !== undefined && { memoAnswer: memoAnswer || null }),
        ...(options !== undefined && { options: options || null }),
        ...(rubric !== undefined && { rubric: rubric || null }),
      },
      include: { variants: true },
    });

    res.json(question);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// DELETE /questions/:id
// Delete a question and all its variants
router.delete('/questions/:id', ...requireRole('organiser'), async (req, res) => {
  try {
    const question = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: { paper: { include: { round: { include: { olympiad: true } } } } },
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (!(await isOlympiadOrganiser(req.user.id, question.paper.round.olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    // Delete all variants first, then the question
    await prisma.questionVariant.deleteMany({
      where: { questionId: req.params.id },
    });
    await prisma.question.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// GET /questions/:id/variants
// List all variants for a question
router.get('/questions/:id/variants', async (req, res) => {
  try {
    const question = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: { paper: { include: { round: { include: { olympiad: true } } } } },
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (!(await isOlympiadOrganiser(req.user?.id, question.paper.round.olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    const variants = await prisma.questionVariant.findMany({
      where: { questionId: req.params.id },
      orderBy: { label: 'asc' },
    });

    res.json(variants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch variants' });
  }
});

// POST /questions/:id/variants
// Create a new variant for a question
router.post('/questions/:id/variants', ...requireRole('organiser'), async (req, res) => {
  try {
    const { label, text, memoAnswer, options } = req.body;

    if (!label) {
      return res.status(400).json({ error: 'label is required' });
    }

    // Verify question exists and check authorization
    const question = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: { paper: { include: { round: { include: { olympiad: true } } } } },
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (!(await isOlympiadOrganiser(req.user.id, question.paper.round.olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    // Check if variant label already exists for this question
    const existing = await prisma.questionVariant.findUnique({
      where: { questionId_label: { questionId: req.params.id, label } },
    });
    if (existing) {
      return res.status(409).json({
        error: `Variant '${label}' already exists for this question`,
      });
    }

    const variant = await prisma.questionVariant.create({
      data: {
        questionId: req.params.id,
        label,
        text: text || null,
        memoAnswer: memoAnswer || null,
        options: options || null,
      },
    });

    res.status(201).json(variant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create variant' });
  }
});

// PUT /variants/:id
// Update a variant
router.put('/variants/:id', ...requireRole('organiser'), async (req, res) => {
  try {
    const { label, text, memoAnswer, options } = req.body;

    // Verify variant exists and check authorization
    const existing = await prisma.questionVariant.findUnique({
      where: { id: req.params.id },
      include: {
        question: { include: { paper: { include: { round: { include: { olympiad: true } } } } } },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    if (!(await isOlympiadOrganiser(req.user.id, existing.question.paper.round.olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    // Check if new label conflicts with existing variants
    if (label !== undefined && label !== existing.label) {
      const conflict = await prisma.questionVariant.findUnique({
        where: {
          questionId_label: { questionId: existing.questionId, label },
        },
      });
      if (conflict) {
        return res.status(409).json({
          error: `Variant '${label}' already exists for this question`,
        });
      }
    }

    const variant = await prisma.questionVariant.update({
      where: { id: req.params.id },
      data: {
        ...(label !== undefined && { label }),
        ...(text !== undefined && { text: text || null }),
        ...(memoAnswer !== undefined && { memoAnswer: memoAnswer || null }),
        ...(options !== undefined && { options: options || null }),
      },
    });

    res.json(variant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update variant' });
  }
});

// DELETE /variants/:id
// Delete a variant
router.delete('/variants/:id', ...requireRole('organiser'), async (req, res) => {
  try {
    const variant = await prisma.questionVariant.findUnique({
      where: { id: req.params.id },
      include: {
        question: { include: { paper: { include: { round: { include: { olympiad: true } } } } } },
      },
    });

    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    if (!(await isOlympiadOrganiser(req.user.id, variant.question.paper.round.olympiadId))) {
      return res.status(403).json({ error: 'You are not an organiser of this olympiad' });
    }

    await prisma.questionVariant.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete variant' });
  }
});

module.exports = router;
