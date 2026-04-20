import { createServer } from 'node:http';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// 1. Serve your movie website files from the 'dist' folder
app.use(express.static(path.join(__dirname, 'dist')));

// 2. Serve Scramjet distribution files (the engine)
// This path points to where the actual code lives inside your project
app.use('/scramjet/', express.static(path.join(__dirname, 'node_modules/@mercuryworkshop/scramjet/dist/')));

// 3. Handle website routing (prevents 404 errors when refreshing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
