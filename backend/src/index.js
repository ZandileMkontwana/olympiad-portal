const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const papersRouter = require('./routes/papers');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api', papersRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on :${PORT}`));