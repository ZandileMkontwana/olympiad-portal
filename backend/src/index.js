const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const papersRouter = require('./routes/papers');
const roundsRouter = require('./routes/rounds');
const submissionsRouter = require('./routes/submissions');
const { startScheduler } = require('./scheduler');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api', papersRouter);
app.use('/api', roundsRouter);
app.use('/api', submissionsRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Backend running on :${PORT}`);
    startScheduler();
});