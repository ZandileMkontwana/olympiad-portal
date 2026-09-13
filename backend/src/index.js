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
const markingRouter = require('./routes/marking');
const authRouter = require('./routes/auth');
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
app.use('/api', markingRouter);
app.use('/api', authRouter);

// 404 handler — anything that didn't match a route above
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

// Global error handler — MUST have 4 args so Express recognizes it as
// an error handler. Without this, any thrown/next(err) error (e.g. from
// requireAuth(), Prisma, or anywhere else) falls through to Express's
// built-in default handler, which returns an HTML page instead of JSON
// and breaks every frontend res.json() call.
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);

  // Clerk's requireAuth() throws when there's no valid session/token
  if (err && (err.clerkError || err.status === 401 || err.name === 'ClerkAPIResponseError')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Backend running on :${PORT}`);
    startScheduler();
  });
}

module.exports = app;
