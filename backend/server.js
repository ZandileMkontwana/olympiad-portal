const express = require('express');
const { PrismaClient } = require('./generated/prisma');
const { startScheduler } = require('./scheduler');

const app = express();
const prisma = new PrismaClient();
const PORT = 3001;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Backend is running');
});

// POST /olympiads — create a new olympiad
app.post('/olympiads', async (req, res) => {
  try {
    const { name, timezone } = req.body;
    if (!name || !timezone) {
      return res.status(400).json({ error: 'name and timezone are required' });
    }
    const olympiad = await prisma.olympiad.create({
      data: { name, timezone },
    });
    res.status(201).json(olympiad);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create olympiad' });
  }
});

// POST /rounds — create a new round under an olympiad
app.post('/rounds', async (req, res) => {
  try {
    const { olympiadId, name, openTime, closeTime } = req.body;
    if (!olympiadId || !name || !openTime || !closeTime) {
      return res.status(400).json({ error: 'olympiadId, name, openTime, and closeTime are required' });
    }
    if (new Date(closeTime) <= new Date(openTime)) {
      return res.status(400).json({ error: 'closeTime must be after openTime' });
    }
    const round = await prisma.round.create({
      data: {
        olympiadId,
        name,
        openTime: new Date(openTime),
        closeTime: new Date(closeTime),
      },
    });
    res.status(201).json(round);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create round' });
  }
});

// GET /rounds/:id — get a single round's current state
app.get('/rounds/:id', async (req, res) => {
  try {
    const round = await prisma.round.findUnique({
      where: { id: req.params.id },
    });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }
    res.json(round);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch round' });
  }
});

// GET /olympiads/:id/rounds — list all rounds for an olympiad
app.get('/olympiads/:id/rounds', async (req, res) => {
  try {
    const rounds = await prisma.round.findMany({
      where: { olympiadId: req.params.id },
      orderBy: { openTime: 'asc' },
    });
    res.json(rounds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rounds' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startScheduler();
});