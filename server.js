import { createServer } from 'node:http';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// 1. Serve Scramjet engine files
app.use('/scramjet/', express.static(path.join(__dirname, 'node_modules/@mercuryworkshop/scramjet/dist/')));

// 2. Serve your built website (Vite output)
app.use(express.static(path.join(__dirname, 'dist')));

// 3. Specifically serve the Service Worker from the root
app.get('/sw.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'sw.js'));
});

// 4. Catch-all for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server live on port ${PORT}`);
});
