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
const moveableTiles = {};

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
    currentMap: 'map' // Add default map
  };

  // Send ALL players initially (for backward compatibility)
  socket.emit('currentPlayers', players);
  
  // Initialize moveable tiles handlers
  socket.on('initializeMoveableTiles', (tiles) => {
    if (Object.keys(moveableTiles).length === 0) {
      console.log('Initializing moveable tiles from first player');
      Object.assign(moveableTiles, tiles);
    }
    socket.emit('moveableTilesState', moveableTiles);
  });

  socket.on('requestMoveableTilesState', () => {
    socket.emit('moveableTilesState', moveableTiles);
  });
  
  socket.emit('moveableTilesState', moveableTiles);
  
  // Notify others on the SAME MAP about the new player
  for (const id in players) {
    if (id !== socket.id && players[id].currentMap === 'map') {
      io.to(id).emit('newPlayer', players[socket.id]);
    }
  }

  // Listen for the 'meow' event from a client
  socket.on('meow', () => {
    io.emit('meow', socket.id);
  });

  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      players[socket.id].direction = movementData.direction;
      
      // Only broadcast to players on the same map
      for (const id in players) {
        if (id !== socket.id && players[id].currentMap === players[socket.id].currentMap) {
          io.to(id).emit('playerMoved', players[socket.id]);
        }
      }
    }
  });

  socket.on('playerChangedMap', (data) => {
      if (players[socket.id]) {
          const oldMap = players[socket.id].currentMap;
          
          // Update player data
          players[socket.id].currentMap = data.map;
          players[socket.id].x = data.x;
          players[socket.id].y = data.y;
          
          // Remove from old map viewers
          for (const id in players) {
              if (id !== socket.id && players[id].currentMap === oldMap) {
                  io.to(id).emit('playerDisconnected', socket.id);
              }
          }
          
          // CRITICAL: Send existing players on new map to the teleporting player
          const playersOnNewMap = {};
          for (const id in players) {
              if (id !== socket.id && players[id].currentMap === data.map) {
                  playersOnNewMap[id] = players[id];
              }
          }
          socket.emit('currentPlayers', playersOnNewMap);
          
          // Then notify others on new map that this player arrived
          for (const id in players) {
              if (id !== socket.id && players[id].currentMap === data.map) {
                  io.to(id).emit('newPlayer', players[socket.id]);
              }
          }
      }
  });

  socket.on('requestPlayersOnMap', (mapName) => {
    const playersOnMap = {};
    for (const id in players) {
      if (id !== socket.id && players[id].currentMap === mapName) {
        playersOnMap[id] = players[id];
      }
    }
    socket.emit('currentPlayers', playersOnMap);
  });

  socket.on('requestPlayersUpdate', () => {
    const requesterMap = players[socket.id]?.currentMap || 'map';
    const playersOnSameMap = {};
    for (const id in players) {
      if (id !== socket.id && players[id].currentMap === requesterMap) {
        playersOnSameMap[id] = players[id];
      }
    }
    socket.emit('currentPlayers', playersOnSameMap);
  });

  socket.on('moveableTileMoved', (data) => {
    if (!data || !data.old || !data.new || data.tileIndex === undefined) {
      console.error('Invalid moveableTileMoved data:', data);
      return;
    }
    
    let originalTileId = null;
    for (const id in moveableTiles) {
      const tile = moveableTiles[id];
      if (tile.x === data.old.x && tile.y === data.old.y) {
        originalTileId = id;
        break;
      }
    }
    
    if (!originalTileId) {
      originalTileId = `${data.old.x},${data.old.y}`;
    }
    
    moveableTiles[originalTileId] = {
      x: data.new.x,
      y: data.new.y,
      tileIndex: data.tileIndex
    };
    
    socket.broadcast.emit('moveableTileUpdated', data);
    
    setTimeout(() => {
      io.emit('moveableTilesState', moveableTiles);
    }, 400);
  });

  socket.on('playerTeleport', (newPosition) => {
    if (players[socket.id]) {
      players[socket.id].x = newPosition.x;
      players[socket.id].y = newPosition.y;
      
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