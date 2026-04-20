import { createServer } from 'node:http';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// 1. Serve your React website files
app.use(express.static(path.join(__dirname, 'dist')));

// 2. Serve the Scramjet engine files directly from node_modules
// This path is specific to the .tgz version in your package.json
app.use('/scramjet/', express.static(path.join(__dirname, 'node_modules/@mercuryworkshop/scramjet/dist/')));

// 3. Routing for the React single-page app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is live on port ${PORT}`);
});
