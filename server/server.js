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
  console.log(`Player connected: ${socket.id}`);

  socket.on('playerChangedMap', (data) => {
    // Initialize player if they don't exist
    if (!players[socket.id]) {
        players[socket.id] = {
            x: data.x,
            y: data.y,
            direction: 'down-right',
            playerId: socket.id,
            currentMap: data.map
        };
    } else {
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
    }
    
    // Initialize moveableTiles for this map if needed
    if (!moveableTiles[data.map]) {
      moveableTiles[data.map] = {};
    }
    
    // Send players on the same map
    const playersOnSameMap = {};
    for (const id in players) {
        if (id !== socket.id && players[id].currentMap === data.map) {
            playersOnSameMap[id] = players[id];
        }
    }
    socket.emit('currentPlayers', playersOnSameMap);
    
    // Send current tile state for this map
    socket.emit('moveableTilesState', moveableTiles[data.map]);
    
    // Notify others on the same map about this player
    for (const id in players) {
        if (id !== socket.id && players[id].currentMap === data.map) {
            io.to(id).emit('newPlayer', players[socket.id]);
        }
    }
  });

  // Client sends initial tile positions when joining a map
  socket.on('initializeMoveableTiles', (data) => {
    const mapName = players[socket.id]?.currentMap || 'map';
    
    // Only initialize if this map has no tiles yet
    if (!moveableTiles[mapName] || Object.keys(moveableTiles[mapName]).length === 0) {
      moveableTiles[mapName] = data.tiles;
      console.log(`Initialized ${Object.keys(data.tiles).length} tiles for map: ${mapName}`);
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
      console.error('Invalid moveableTileMoved data');
      return;
    }
    
    const mapName = players[socket.id]?.currentMap;
    if (!mapName || !moveableTiles[mapName]) {
      console.error('Invalid map for tile move');
      return;
    }
    
    // Validate: check if tile exists at old position
    const oldKey = `${data.old.x},${data.old.y}`;
    const existingTile = moveableTiles[mapName][oldKey];
    
    if (!existingTile) {
      console.warn(`Tile push rejected - no tile at (${data.old.x},${data.old.y})`);
      // Send correction to client
      socket.emit('tilePushRejected', { position: data.old });
      return;
    }
    
    // Validate: check if destination is already occupied
    const newKey = `${data.new.x},${data.new.y}`;
    if (moveableTiles[mapName][newKey]) {
      console.warn(`Tile push rejected - destination occupied at (${data.new.x},${data.new.y})`);
      socket.emit('tilePushRejected', { position: data.old });
      return;
    }
    
    // Server authorizes the move
    delete moveableTiles[mapName][oldKey];
    moveableTiles[mapName][newKey] = {
        x: data.new.x,
        y: data.new.y,
        tileIndex: data.tileIndex
    };
    
    // Add the pusherId to the broadcast data
    const broadcastData = {
        ...data,
        pusherId: socket.id  // Include the pusher's ID
    };
    
    // Broadcast to ALL clients on this map (including sender for state sync)
    for (const id in players) {
      if (players[id].currentMap === mapName) {
        io.to(id).emit('moveableTileUpdated', broadcastData);
      }
    }
});

  socket.on('meow', () => {
    const mapName = players[socket.id]?.currentMap;
    if (mapName) {
      // Only broadcast to players on same map
      for (const id in players) {
        if (players[id].currentMap === mapName) {
          io.to(id).emit('meow', socket.id);
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const mapName = players[socket.id]?.currentMap;
    delete players[socket.id];
    
    // Only notify players on the same map
    if (mapName) {
      for (const id in players) {
        if (players[id].currentMap === mapName) {
          io.to(id).emit('playerDisconnected', socket.id);
        }
      }
    }
  });
});

server.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});