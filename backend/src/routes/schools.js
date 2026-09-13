const express = require('express');
const prisma = require('../lib/prisma');

const router = express.Router();

// GET /schools
// Public list of school names — used by the student registration form
// so students pick their school from a list instead of guessing the
// exact spelling their educator used.
router.get('/schools', async (req, res) => {
  try {
    const schools = await prisma.school.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.json(schools);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch schools' });
  }
});

module.exports = router;
