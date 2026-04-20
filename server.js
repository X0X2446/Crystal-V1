import { createServer } from 'node:http';
import Scramjet from '@mercuryworkshop/scramjet'; // Changed this to the default import
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// 1. Initialize Scramjet using the new Class constructor
const scramjet = new Scramjet();

// 2. Use the middleware to catch /scramjet/ requests
// This MUST be above the express.static line
app.use(scramjet.express);

// 3. Serve your website files
app.use(express.static(path.join(__dirname, 'dist')));

// 4. Handle WebSockets (for video streaming stability)
httpServer.on('upgrade', (req, socket, head) => {
  if (scramjet.shouldRoute(req)) {
    scramjet.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

// 5. Catch-all for the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
