import { createServer } from 'node:http';
import { createBareServer } from '@mercuryworkshop/bare-mux';
import { createScramjetServer } from '@mercuryworkshop/scramjet';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// Sets up the proxy paths
const bare = createBareServer('/bare/');
const scramjet = createScramjetServer('/scramjet/');

// IMPORTANT: This line tells the server to show your movie website
app.use(express.static(path.join(__dirname, 'dist')));

app.on('upgrade', (req, socket, head) => {
  if (bare.shouldRoute(req)) {
    bare.routeUpgrade(req, socket, head);
  } else if (scramjet.shouldRoute(req)) {
    scramjet.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

// This ensures that if you refresh the page, your website still loads
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
