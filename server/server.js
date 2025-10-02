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

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
});

const port = 3001;
const players = {};
const moveableTiles = {};

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
  res.send({access_token});
});

// --- Multiplayer Logic ---
io.on('connection', (socket) => {
  console.log(`🔌 Player connected: ${socket.id}`);

  socket.on('playerChangedMap', (data) => {
    console.log(`📍 [${socket.id}] playerChangedMap:`, data);
    
    // Initialize player if they don't exist
    if (!players[socket.id]) {
        players[socket.id] = {
            x: data.x,
            y: data.y,
            direction: 'down-right',
            playerId: socket.id,
            currentMap: data.map
        };
        console.log(`👤 [${socket.id}] New player created`);
    } else {
        // Update existing player
        const oldMap = players[socket.id].currentMap;
        players[socket.id].currentMap = data.map;
        players[socket.id].x = data.x;
        players[socket.id].y = data.y;
        
        // Notify old map that player left
        if (oldMap !== data.map) {
            for (const id in players) {
                if (id !== socket.id && players[id].currentMap === oldMap) {
                    io.to(id).emit('playerDisconnected', socket.id);
                }
            }
        }
        console.log(`👤 [${socket.id}] Player updated, map: ${data.map}`);
    }
    
    // Send players on the same map
    const playersOnSameMap = {};
    for (const id in players) {
        if (id !== socket.id && players[id].currentMap === data.map) {
            playersOnSameMap[id] = players[id];
        }
    }
    socket.emit('currentPlayers', playersOnSameMap);
    console.log(`📤 [${socket.id}] Sent ${Object.keys(playersOnSameMap).length} other players`);
    
    // Notify others on the same map about this player
    for (const id in players) {
        if (id !== socket.id && players[id].currentMap === data.map) {
            io.to(id).emit('newPlayer', players[socket.id]);
        }
    }
  });

  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      players[socket.id].direction = movementData.direction;
      
      // Broadcast to players on same map
      for (const id in players) {
        if (id !== socket.id && players[id].currentMap === players[socket.id].currentMap) {
          io.to(id).emit('playerMoved', players[socket.id]);
        }
      }
    }
  });

  socket.on('moveableTileMoved', (data) => {
    if (!data || !data.old || !data.new || data.tileIndex === undefined) {
      console.error('Invalid moveableTileMoved data:', data);
      return;
    }
    
    console.log(`📦 [${socket.id}] Tile moved from (${data.old.x},${data.old.y}) to (${data.new.x},${data.new.y})`);
    
    // Update server state
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
    
    // Broadcast to ALL clients (including sender for consistency)
    io.emit('moveableTileUpdated', data);
  });

  socket.on('meow', () => {
    io.emit('meow', socket.id);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Player disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

server.listen(port, () => {
  console.log(`🚀 Server listening at http://localhost:${port}`);
});