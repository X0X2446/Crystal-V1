import { createServer } from 'node:http';
import { createScramjetServer } from '@mercuryworkshop/scramjet';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// 1. Initialize the Scramjet Engine
const scramjet = createScramjetServer('/scramjet/');

// 2. THIS IS THE FIX: Tell Express to use Scramjet's logic for proxying
// This must come BEFORE your static files and wildcard route
app.use(scramjet.express);

// 3. Serve your movie website files
app.use(express.static(path.join(__dirname, 'dist')));

// 4. Handle WebSockets (needed for some video providers to work)
httpServer.on('upgrade', (req, socket, head) => {
  if (scramjet.shouldRoute(req)) {
    scramjet.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

// 5. Catch-all route for the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
