import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config({ path: "../.env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// This 'cors' block is the critical fix
const io = new Server(server, {
  cors: {
    origin: "*", // Allows connections from any origin
    methods: ["GET", "POST"]
  },
});

const port = 3001;
const players = {};

app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// Your Express routes and middleware remain here
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
  res.send({access_token});
});

// --- Multiplayer Logic ---
io.on('connection', (socket) => {
  console.log(`🔌 Player connected: ${socket.id}`);

  players[socket.id] = {
    x: 14, y: 8, direction: 'down-right', playerId: socket.id,
  };

  socket.emit('currentPlayers', players);
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // Listen for the 'meow' event from a client
  socket.on('meow', () => {
    // Broadcast the 'meow' event to all connected clients
    io.emit('meow', socket.id);
  });

  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;
        players[socket.id].direction = movementData.direction;
        socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  // Listen for when a player teleports to a new map
  socket.on('playerTeleport', (newPosition) => {
    if (players[socket.id]) {
      players[socket.id].x = newPosition.x;
      players[socket.id].y = newPosition.y;
      
      // Notify other players of the "move" to the new location
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Player disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

server.listen(port, () => {
  console.log(`🚀 Server listening at http://localhost:${port}`);
});