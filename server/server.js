import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

// These lines are for serving static files from the 'client/dist' folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');

const app = express();
const port = 3001;

// This tells our server to serve the game files
app.use(express.static(clientDistPath));
app.use(express.json());

// This is the same authentication route from the official template
app.post('/api/token', async (req, res) => {
  const response = await fetch(`https://discord.com/api/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.VITE_DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: req.body.code,
    }),
  });

  const { access_token } = await response.json();
  res.send({ access_token });
});

app.listen(port, () => {
  console.log(`[VICTORY] Your unified server is running at http://localhost:${port}`);
});
