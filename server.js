import { createServer } from 'node:http';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// 1. Serve your movie website files from the 'dist' folder
app.use(express.static(path.join(__dirname, 'dist')));

// 2. Serve the Scramjet proxy files directly from node_modules so the browser can find them
app.use('/scramjet', express.static(path.join(__dirname, 'node_modules/@mercuryworkshop/scramjet/dist')));

// 3. Handle website routing (prevents 404 errors when refreshing the page)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 4. Start the server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
