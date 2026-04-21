import { createServer } from 'node:http';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// ── Wisp WebSocket proxy ────────────────────────────────────────────────────
// BareMux needs a Wisp server to tunnel requests. We use the wisp-server-node
// package if available, otherwise fall back to a bare passthrough.
try {
  const { createWispServer } = await import('wisp-server-node');
  createWispServer({ server: httpServer });
  console.log('Wisp server: active');
} catch {
  // wisp-server-node not installed — bare-mux transport won't work but
  // the proxy will still attempt to function
  console.warn('Wisp server: wisp-server-node not found, skipping');
}

// ── Scramjet engine files ───────────────────────────────────────────────────
// Served at /scramjet/ — the SW imports from here, and ScramjetController
// config points here too. Must come BEFORE the catch-all.
app.use('/scramjet/', express.static(
  path.join(__dirname, 'node_modules/@mercuryworkshop/scramjet/dist/'),
  { index: false }
));

// ── BareMux transport ───────────────────────────────────────────────────────
app.use('/baremux/', express.static(
  path.join(__dirname, 'node_modules/@mercuryworkshop/bare-mux/dist/'),
  { index: false }
));

// ── LibCurl transport ───────────────────────────────────────────────────────
app.use('/libcurl/', express.static(
  path.join(__dirname, 'node_modules/@mercuryworkshop/libcurl-transport/dist/'),
  { index: false }
));

// ── Service Worker ──────────────────────────────────────────────────────────
// Must send Service-Worker-Allowed: / so the SW can intercept all paths
app.get('/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'dist', 'sw.js'));
});

// ── Built React app ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'dist')));

// ── SPA catch-all ───────────────────────────────────────────────────────────
// NEVER serve index.html for proxy paths — that was causing the homepage bug.
app.get('*', (req, res) => {
  const p = req.path;
  if (
    p.startsWith('/scramjet/') ||
    p.startsWith('/baremux/')  ||
    p.startsWith('/libcurl/')  ||
    p.startsWith('/wisp/')
  ) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server live on port ${PORT}`));
