const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { isDbBusyError, respondDbBusy } = require('./lib/dbErrors');
require('dotenv').config();
const papersRouter = require('./routes/papers');
const roundsRouter = require('./routes/rounds');
const submissionsRouter = require('./routes/submissions');
const sittingsRouter = require('./routes/sittings');
const entrantsRouter = require('./routes/entrants');
const markingRouter = require('./routes/marking');
const remarkRouter = require('./routes/remark');
const schoolsRouter = require('./routes/schools');
const studentsRouter = require('./routes/students');
const authRouter = require('./routes/auth');
const studentAuthRouter = require('./routes/studentAuth');
const certificatesRouter = require('./routes/certificates');
const olympiadOrganisersRouter = require('./routes/olympiadOrganisers');
const apiKeysRouter = require('./routes/apiKeys');
const externalRouter = require('./routes/external');
const { startScheduler } = require('./scheduler');
const { clerkMiddleware } = require('@clerk/express');

const app = express();

// cors + cookieParser must come BEFORE the routers, or requests never reach them
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  // Allow Vercel preview deployments
  /^https:\/\/.*vercel\.app$/,
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const isAllowed = allowedOrigins.some((allowed) => {
        if (typeof allowed === 'string') return allowed === origin;
        if (allowed instanceof RegExp) return allowed.test(origin);
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Rate limiter for external API endpoints — 100 requests per 15 minutes per API key
const externalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each API key to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable deprecation warnings from `X-RateLimit-*` headers
  keyGenerator: (req) => req.apiKey?.id || req.apiKey?.key || 'anonymous',
  validate: { xForwardedForHeader: false, ip: false }, // Allow API key-based limiting
  message: { error: 'Too many requests, please try again later.' },
});

app.use(cookieParser());
app.use(express.json());
app.use(clerkMiddleware());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Public API endpoints — open CORS so anyone can call them from any origin
app.use('/api/olympiads', cors());
app.use('/api/external', cors());

app.use('/api', papersRouter);
app.use('/api', roundsRouter);
app.use('/api', submissionsRouter);
app.use('/api', sittingsRouter);
app.use('/api', entrantsRouter);
app.use('/api', markingRouter);
app.use('/api', remarkRouter);
app.use('/api', schoolsRouter);
app.use('/api', studentsRouter);
app.use('/api', authRouter);
app.use('/api', studentAuthRouter);
app.use('/api', certificatesRouter);
app.use('/api', olympiadOrganisersRouter);
app.use('/api/api-keys', apiKeysRouter);

// External read-only API with rate limiting
app.use('/api/external', externalRateLimiter, externalRouter);

// JSON 404 for unmatched /api routes (prevents Express's default HTML response)
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// Global error handler — always returns JSON
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (isDbBusyError(err)) {
    return respondDbBusy(req, res, err);
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

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
