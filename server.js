import { createServer } from 'node:http';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// 1. Serve Scramjet engine files — MUST come before the catch-all
//    These are the JS/WASM files the service worker needs to actually work.
app.use('/scramjet/', express.static(
  path.join(__dirname, 'node_modules/@mercuryworkshop/scramjet/dist/'),
  { fallthrough: false }
));

// 2. Serve BareMux transport files
app.use('/baremux/', express.static(
  path.join(__dirname, 'node_modules/@mercuryworkshop/bare-mux/dist/'),
  { fallthrough: false }
));

// 3. Serve libcurl transport files
app.use('/libcurl/', express.static(
  path.join(__dirname, 'node_modules/@mercuryworkshop/libcurl-transport/dist/'),
  { fallthrough: false }
));

// 4. Serve the SW with the correct header so it can claim scope /
app.get('/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'dist', 'sw.js'));
});

// 5. Serve your built website static files
app.use(express.static(path.join(__dirname, 'dist')));

// 6. Catch-all for SPA — but NEVER serve index.html for /scramjet/ paths.
//    If scramjet files are missing, return 404 so the browser knows the SW
//    failed to load rather than silently getting your React app's HTML.
app.get('*', (req, res) => {
  if (req.path.startsWith('/scramjet/') ||
      req.path.startsWith('/baremux/') ||
      req.path.startsWith('/libcurl/') ||
      req.path.startsWith('/wisp/')) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server live on port ${PORT}`);
});
