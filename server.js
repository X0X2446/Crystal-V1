import { createServer } from 'node:http';
import { ScramjetServer } from '@mercuryworkshop/scramjet'; 
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// 1. Initialize the Scramjet Server class
const scramjet = new ScramjetServer();

// 2. Middleware to handle the proxying logic
// This MUST stay above the express.static line to prevent the loop!
app.use(scramjet.express);

// 3. Serve your website files
app.use(express.static(path.join(__dirname, 'dist')));

// 4. Handle WebSockets for video stability
httpServer.on('upgrade', (req, socket, head) => {
  if (scramjet.shouldRoute(req)) {
    scramjet.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

// 5. Wildcard route for React single-page app support
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
