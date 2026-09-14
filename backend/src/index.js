const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();
const papersRouter = require('./routes/papers');
const roundsRouter = require('./routes/rounds');
const submissionsRouter = require('./routes/submissions');
const sittingsRouter = require('./routes/sittings');
const entrantsRouter = require('./routes/entrants');
const authRouter = require('./routes/auth');
const certificatesRouter = require('./routes/certificates');
const { startScheduler } = require('./scheduler');
const { clerkMiddleware } = require('@clerk/express');

const app = express();

// cors + cookieParser must come BEFORE the routers, or requests never reach them
app.use(
  cors({
    origin: ['http://localhost:3000', 'https://frontend-two-ruby-25.vercel.app'],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(clerkMiddleware());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api', papersRouter);
app.use('/api', roundsRouter);
app.use('/api', submissionsRouter);
app.use('/api', sittingsRouter);
app.use('/api', entrantsRouter);
app.use('/api', authRouter);
app.use('/api', certificatesRouter);

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Backend running on :${PORT}`);
    startScheduler();
  });
}

module.exports = app;
