const express = require('express');
const activityBus = require('../lib/activityBus');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const RECENT_LIMIT = 30;
const STREAM_HEARTBEAT_MS = 25 * 1000;

// GET /activity/stream — Server-Sent Events feed of portal activity for the
// organiser dashboard (US-4.1). One-directional server -> browser: the
// scheduler and route handlers broadcast through lib/activityBus.js and every
// connected client receives the event in real time.
//
// EventSource cannot set Authorization headers, so the Clerk token travels as
// a ?token= query parameter; the app-level middleware in index.js promotes it
// to a Bearer header before clerkMiddleware runs, so the standard auth chain
// applies unchanged.
router.get('/activity/stream', ...requireRole('organiser'), (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Stop proxy buffers (Render/nginx) from holding chunks back
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  // Native EventSource reconnects by itself; tell it how long to wait.
  res.write('retry: 5000\n\n');

  // Catch-up history: one named SSE event carrying the recent buffer
  // (newest-first). Sent on every (re)connect so a dropped connection never
  // loses more than the seconds it was down.
  res.write(`event: history\ndata: ${JSON.stringify(activityBus.recent(RECENT_LIMIT))}\n\n`);

  const unsubscribe = activityBus.subscribe((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  // SSE comment frames are ignored by EventSource but keep idle connections
  // alive through proxies that would otherwise time them out.
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, STREAM_HEARTBEAT_MS);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

module.exports = router;
