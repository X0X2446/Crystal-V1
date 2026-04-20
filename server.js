import { createServer } from 'node:http';
import { Scramjet } from '@mercuryworkshop/scramjet'; 
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// 1. Initialize the Scramjet class
const scramjet = new Scramjet();

// 2. Intercept proxy requests before they hit the static files
app.use(scramjet.express);

// 3. Serve your built website
app.use(express.static(path.join(__dirname, 'dist')));

// 4. Required for many video streaming sources
httpServer.on('upgrade', (req, socket, head) => {
  if (scramjet.shouldRoute(req)) {
    scramjet.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

// 5. Frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
