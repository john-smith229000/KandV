import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

dotenv.config({ path: "../.env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database setup
const file = path.join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter);

// Set default data if the database is empty
await db.read();
db.data ||= { sessions: {} };
await db.write();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  },
});

const port = 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.removeHeader('X-Frame-Options'); 
  next();
});

app.post("/api/token", async (req, res) => {
  const response = await fetch(`https://discord.com/api/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.VITE_DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: req.body.code,
    }),
  });

  const { access_token } = await response.json();
  res.send({ access_token });
});

// --- Multiplayer Logic ---
io.on('connection', (socket) => {
  console.log(`🔌 Player connected: ${socket.id}`);

  socket.on('playerReady', async ({ sessionID, userID }) => {
    if (!sessionID) return;

    socket.join(sessionID);
    socket.sessionID = sessionID;
    socket.userID = userID;

    await db.read();
    let session = db.data.sessions[sessionID];

    if (!session) {
      // Create a new session if one doesn't exist
      session = {
        players: {},
        moveableTiles: {},
        currentMap: 'map',
        spawnPos: { x: 13, y: 11 },
        storyFlags: {},
      };
      db.data.sessions[sessionID] = session;
    }

    session.players[socket.id] = {
      playerId: socket.id,
      userId: userID,
      x: session.spawnPos.x,
      y: session.spawnPos.y,
      direction: 'down-right',
      currentMap: session.currentMap,
    };

    await db.write();

    socket.emit('sessionLoad', session);
    socket.to(sessionID).emit('newPlayer', session.players[socket.id]);
  });

  socket.on('saveSessionState', async (sessionData) => {
    const { sessionID } = socket;
    if (!sessionID || !db.data.sessions[sessionID]) return;

    db.data.sessions[sessionID] = {
      ...db.data.sessions[sessionID],
      ...sessionData,
    };
    await db.write();
  });

  socket.on('playerMovement', (movementData) => {
    const { sessionID } = socket;
    if (!sessionID || !db.data.sessions[sessionID] || !db.data.sessions[sessionID].players[socket.id]) return;

    const player = db.data.sessions[sessionID].players[socket.id];
    player.x = movementData.x;
    player.y = movementData.y;
    player.direction = movementData.direction;

    socket.to(sessionID).emit('playerMoved', player);
  });

  socket.on('moveableTileMoved', (data) => {
    const { sessionID } = socket;
    if (!sessionID || !db.data.sessions[sessionID]) return;

    const { old, new: newPos, tileIndex } = data;
    const session = db.data.sessions[sessionID];

    let tileId = null;
    for (const id in session.moveableTiles) {
      if (session.moveableTiles[id].x === old.x && session.moveableTiles[id].y === old.y) {
        tileId = id;
        break;
      }
    }

    if (tileId) {
      session.moveableTiles[tileId] = { x: newPos.x, y: newPos.y, tileIndex };
      socket.to(sessionID).emit('moveableTileUpdated', data);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Player disconnected: ${socket.id}`);
    const { sessionID } = socket;
    if (!sessionID || !db.data.sessions[sessionID]) return;

    delete db.data.sessions[sessionID].players[socket.id];
    io.to(sessionID).emit('playerDisconnected', socket.id);

    db.write();
  });
});

server.listen(port, () => {
  console.log(`🚀 Server listening at http://localhost:${port}`);
});