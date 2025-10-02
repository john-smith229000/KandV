import Phaser from 'phaser';

// isometric.js - Helper functions for isometric games
export class IsometricHelper {
  constructor(tileWidth = 64, tileHeight = 32) {
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
  }

  // Convert isometric coordinates to screen coordinates
  isoToScreen(isoX, isoY) {
    const screenX = (isoX - isoY) * (this.tileWidth / 2);
    const screenY = (isoX + isoY) * (this.tileHeight / 2);
    return { x: screenX, y: screenY };
  }

  // Convert screen coordinates to isometric coordinates
  screenToIso(screenX, screenY) {
    const isoX = (screenX / (this.tileWidth / 2) + screenY / (this.tileHeight / 2)) / 2;
    const isoY = (screenY / (this.tileHeight / 2) - screenX / (this.tileWidth / 2)) / 2;
    return { x: Math.floor(isoX), y: Math.floor(isoY) };
  }
}

export class IsometricPlayer {
  constructor(scene, startIsoX = 13, startIsoY = 11, socket) {
    this.scene = scene;
    this.socket = socket;
    this.tilemap = null;
    this.waterSound = null;
    
    this.gridX = startIsoX;
    this.gridY = startIsoY;
    
    this.sprite = scene.add.sprite(0, 0, 'cat1').setScale(0.3).setOrigin(0.35, 0.75);

    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCircle(35); 
    this.sprite.body.setOffset(0, 0); 

    this.defaultMoveSpeed = 125;
    this.moveSpeed = this.defaultMoveSpeed;
    this.isMoving = false;
    
    // Track tiles we're currently pushing to prevent race conditions
    this.pushingTiles = new Set();
    
    console.log('🐱 Player created at grid:', startIsoX, startIsoY);
  }

  setTilemap(tilemap) {
      this.tilemap = tilemap;
      this.updateVisualPosition();
  }

  isValidTile(gridX, gridY) {
      if (!this.tilemap) return true;
      const mapWidth = this.tilemap.width;
      const mapHeight = this.tilemap.height;

      if (gridX < 0 || gridY < 0 || gridX >= mapWidth || gridY >= mapHeight) {
          return false;
      }

      const layerData = this.tilemap.getLayer('Ground').data;
      const row = layerData[gridY];
      const tileAtCoords = row ? row[gridX] : null;

      return !!tileAtCoords && tileAtCoords.index !== -1;
  }

  gridToWorldPosition(gridX, gridY, center = true) {
      if (!this.tilemap) {
          return { x: gridX * 32, y: gridY * 16 };
      }

      let worldPos = this.tilemap.tileToWorldXY(gridX, gridY);
      
      if (!worldPos) {
          return { x: 0, y: 0 };
      }
      
      if (center) {
          worldPos.x += 16;
          worldPos.y += 16;
      }
      
      return worldPos;
  }

  updateVisualPosition() {
      const worldPos = this.gridToWorldPosition(this.gridX, this.gridY);
      this.sprite.setPosition(worldPos.x, worldPos.y);
      this.sprite.setDepth(worldPos.y);
  }

  move(direction) {
    if (this.isMoving || !direction) return;

    let targetGridX = this.gridX;
    let targetGridY = this.gridY;
    const isOddRow = this.gridY % 2 === 1;

    switch (direction) {
        case 'up-left':
            targetGridY--;
            targetGridX = this.gridX - (isOddRow ? 0 : 1);
            break;
        case 'up-right':
            targetGridY--;
            targetGridX = this.gridX + (isOddRow ? 1 : 0);
            break;
        case 'down-right':
            targetGridY++;
            targetGridX = this.gridX + (isOddRow ? 1 : 0);
            break;
        case 'down-left':
            targetGridY++;
            targetGridX = this.gridX - (isOddRow ? 0 : 1);
            break;
    }
    
    console.log(`🎮 Attempting move from (${this.gridX},${this.gridY}) to (${targetGridX},${targetGridY}) direction: ${direction}`);
    this.moveToGridPosition(targetGridX, targetGridY, direction);
  }

  moveToGridPosition(targetGridX, targetGridY, direction) {
    if (this.isMoving || document.hidden) return;

    let isPushing = false;
    
    // Check for moveable tile at target position
    if (this.scene && this.scene.moveableLayer) {
        const moveableTile = this.scene.moveableLayer.getTileAt(targetGridX, targetGridY, true);
        console.log(`📦 Checking for moveable tile at (${targetGridX},${targetGridY}):`, moveableTile ? moveableTile.index : 'none');
        
        if (moveableTile && moveableTile.index !== -1) {
            isPushing = true;
            console.log('📦 Found moveable tile! Attempting to push...');
            
            // Calculate push direction
            let pushDeltaX = 0;
            let pushDeltaY = 0;
            const isOddRow = targetGridY % 2 === 1;
            
            switch(direction) {
                case 'up-left': 
                    pushDeltaY = -1; 
                    pushDeltaX = isOddRow ? 0 : -1; 
                    break;
                case 'up-right': 
                    pushDeltaY = -1; 
                    pushDeltaX = isOddRow ? 1 : 0; 
                    break;
                case 'down-right': 
                    pushDeltaY = 1; 
                    pushDeltaX = isOddRow ? 1 : 0; 
                    break;
                case 'down-left': 
                    pushDeltaY = 1; 
                    pushDeltaX = isOddRow ? 0 : -1; 
                    break;
            }
            
            const pushToX = targetGridX + pushDeltaX;
            const pushToY = targetGridY + pushDeltaY;
            console.log(`📦 Trying to push tile to (${pushToX},${pushToY})`);

            // Check if push destination is valid
            const groundTileAtTarget = this.tilemap.getTileAt(pushToX, pushToY, true, 'Ground');
            const bridgeTileAtTarget = this.tilemap.getLayer('Bridge') ? 
                this.tilemap.getTileAt(pushToX, pushToY, true, 'Bridge') : null;
            const isBridgePresent = bridgeTileAtTarget && bridgeTileAtTarget.index !== -1;
            const isWater = !isBridgePresent && groundTileAtTarget && groundTileAtTarget.properties.water === "1";
            const destinationTile = this.scene.moveableLayer.getTileAt(pushToX, pushToY, true);
            
            // Check if we're already pushing a tile to this position
            const pushKey = `${pushToX},${pushToY}`;
            if (this.pushingTiles.has(pushKey)) {
                console.log('⚠️ Already pushing a tile to this position');
                return;
            }
            
            console.log(`📦 Push destination check - valid: ${this.isValidTile(pushToX, pushToY)}, blocked: ${destinationTile && destinationTile.index !== -1}, water: ${isWater}`);
            
            if (this.isValidTile(pushToX, pushToY) && 
                (!destinationTile || destinationTile.index === -1) && 
                !isWater) {
                
                console.log('✅ Push is valid! Creating animation and updating state...');
                
                // Mark this position as being pushed to
                this.pushingTiles.add(pushKey);
                
                // IMMEDIATELY update the logical tile position (prevents phase-through)
                this.scene.moveableLayer.removeTileAt(targetGridX, targetGridY);
                this.scene.moveableLayer.putTileAt(moveableTile.index, pushToX, pushToY);
                
                // Create visual animation (purely cosmetic, doesn't affect collision)
                this.createLocalTilePushAnimation(
                    { x: targetGridX, y: targetGridY },
                    { x: pushToX, y: pushToY },
                    moveableTile.index
                );
                
                // Clear the pushing flag after animation would complete
                this.scene.time.delayedCall(this.defaultMoveSpeed * 2 * 1.6, () => {
                    this.pushingTiles.delete(pushKey);
                });
                
                const moveData = { 
                    old: { x: targetGridX, y: targetGridY }, 
                    new: { x: pushToX, y: pushToY }, 
                    tileIndex: moveableTile.index,
                    pusherId: this.socket.id  // Add pusher ID to identify who pushed
                };
                
                if (this.socket && this.socket.connected) {
                    console.log('📤 Emitting moveableTileMoved:', moveData);
                    this.socket.emit('moveableTileMoved', moveData);
                } else {
                    console.log('⚠️ Socket not connected, cannot emit tile move');
                }
                
                // Now the tile is already moved logically, player can move into the space
                this.moveSpeed = this.defaultMoveSpeed * 2;
            } else {
                console.log('❌ Push blocked - cannot push tile');
                return;
            }
        }
    }

    // Handle normal movement (not pushing)
    if (!isPushing) {
        if (!this.isValidTile(targetGridX, targetGridY)) {
            console.log('❌ Invalid tile at target position');
            return;
        }
        
        this.moveSpeed = this.defaultMoveSpeed;

        const bridgeTile = this.tilemap.getLayer('Bridge') ? 
            this.tilemap.getTileAt(targetGridX, targetGridY, true, 'Bridge') : null;
        const groundTile = this.tilemap.getLayer('Ground') ? 
            this.tilemap.getTileAt(targetGridX, targetGridY, true, 'Ground') : null;
        
        const isBridgePresent = bridgeTile && bridgeTile.index !== -1;
        const isWater = !isBridgePresent && groundTile && groundTile.properties.water === "1";

        if (isWater) {
            this.moveSpeed = this.defaultMoveSpeed * 2.0;
            if (!this.waterSound || !this.waterSound.isPlaying) {
                if (!this.waterSound) this.waterSound = this.scene.sound.add('water_sound', { loop: true });
                this.waterSound.play();
            }
        } else {
            if (this.waterSound && this.waterSound.isPlaying) this.waterSound.stop();
        }
    } else {
        if (this.waterSound && this.waterSound.isPlaying) this.waterSound.stop();
    }

    // --- Player movement tween ---
    this.isMoving = true;
    this.updateSpriteDirection(direction);
    const endWorldPos = this.gridToWorldPosition(targetGridX, targetGridY, true);

    console.log(`🚶 Starting movement tween to (${targetGridX},${targetGridY})`);

    this.scene.tweens.add({
        targets: this.sprite,
        x: endWorldPos.x,
        y: endWorldPos.y,
        duration: this.moveSpeed * 1.6,
        ease: 'Linear',
        onUpdate: () => {
            this.sprite.setDepth(this.sprite.y);
        },
        onComplete: () => {
            this.isMoving = false;
            this.gridX = targetGridX;
            this.gridY = targetGridY;
            
            console.log(`✅ Movement complete at (${this.gridX},${this.gridY})`);
            
            if (this.socket && this.socket.connected) {
                console.log('📤 Emitting playerMovement');
                this.socket.emit('playerMovement', { 
                    x: this.gridX, 
                    y: this.gridY, 
                    direction: direction 
                });
            } else {
                console.log('⚠️ Socket not connected, cannot emit movement');
            }
        }
    });
  }

  createLocalTilePushAnimation(oldPos, newPos, tileIndex) {
    // This creates a purely visual animation that doesn't affect collision
    // The actual tile has already been moved in the tilemap
    
    const tileWorldStart = this.gridToWorldPosition(oldPos.x, oldPos.y, true);
    const tileWorldEnd = this.gridToWorldPosition(newPos.x, newPos.y, true);
    
    // Hide the actual tile at the new position temporarily
    const newTile = this.scene.moveableLayer.getTileAt(newPos.x, newPos.y);
    if (newTile) {
        newTile.setVisible(false);
    }
    
    // Create temporary sprite for animation
    const tileset = this.scene.map.tilesets[0];
    const tileTextureKey = tileset.image.key;
    const columns = tileset.columns;
    const frameIndex = tileIndex - tileset.firstgid;
    
    const frameX = (frameIndex % columns) * tileset.tileWidth;
    const frameY = Math.floor(frameIndex / columns) * tileset.tileHeight;

    const uniqueKey = `local_push_tile_${Date.now()}_${Math.random()}`;
    const texture = this.scene.textures.get(tileTextureKey);
    const source = texture.getSourceImage();

    const canvas = document.createElement('canvas');
    canvas.width = tileset.tileWidth;
    canvas.height = tileset.tileHeight;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(
        source, 
        frameX, frameY, 
        tileset.tileWidth, tileset.tileHeight,
        0, 0, 
        tileset.tileWidth, tileset.tileHeight
    );

    this.scene.textures.addCanvas(uniqueKey, canvas);

    const tempTileSprite = this.scene.add.sprite(tileWorldStart.x, tileWorldStart.y, uniqueKey);
    tempTileSprite.setOrigin(0.5, 0.5);
    tempTileSprite.setDepth(tileWorldStart.y);

    this.scene.tweens.add({
        targets: tempTileSprite,
        x: tileWorldEnd.x,
        y: tileWorldEnd.y,
        onUpdate: () => {
            tempTileSprite.setDepth(tempTileSprite.y);
        },
        duration: this.defaultMoveSpeed * 2 * 1.6,
        ease: 'Linear',
        onComplete: () => {
            // Show the actual tile again
            if (newTile) {
                newTile.setVisible(true);
            }
            
            // Clean up animation sprite
            tempTileSprite.destroy();
            this.scene.textures.remove(uniqueKey);
        }
    });
  }

  animateTilePush(data, isLocalPush = false) {
    const { old, new: newPos, tileIndex, pusherId } = data;
    console.log(`🎬 Received tile push event from (${old.x},${old.y}) to (${newPos.x},${newPos.y})`);

    // If this is the local player who pushed, don't animate (already animated locally)
    if (pusherId === this.socket.id) {
        console.log('👤 This is our own push, skipping animation (already animated locally)');
        // Ensure the tile is in the correct position (in case of desync)
        const tileAtNew = this.scene.moveableLayer.getTileAt(newPos.x, newPos.y);
        if (!tileAtNew || tileAtNew.index === -1) {
            this.scene.moveableLayer.removeTileAt(old.x, old.y);
            this.scene.moveableLayer.putTileAt(tileIndex, newPos.x, newPos.y);
        }
        return;
    }

    // For other players: animate the tile movement
    console.log('👥 Animating tile push from another player');

    // If tab is hidden, just update state immediately
    if (document.hidden) {
        console.log('👁️ Tab hidden, instant update');
        if (this.scene.moveableLayer) {
            // Clean ALL positions in tilemap
            this.scene.moveableLayer.forEachTile(tile => {
                if (tile && tile.index === tileIndex) {
                    this.scene.moveableLayer.removeTileAt(tile.x, tile.y);
                }
            });
            // Place at new position
            this.scene.moveableLayer.putTileAt(tileIndex, newPos.x, newPos.y);
        }
        return;
    }

    // Initialize tracking maps if needed
    if (!this.scene.animatingTiles) this.scene.animatingTiles = new Set();
    if (!this.scene.tileAnimationSprites) this.scene.tileAnimationSprites = new Map();
    
    // Clean up any existing animation sprite for this tile
    const existingSprites = [];
    this.scene.tileAnimationSprites.forEach((sprite, key) => {
        if (sprite.tileIndex === tileIndex) {
            existingSprites.push(key);
        }
    });
    
    existingSprites.forEach(key => {
        const sprite = this.scene.tileAnimationSprites.get(key);
        if (sprite && sprite.active) {
            sprite.destroy();
        }
        this.scene.tileAnimationSprites.delete(key);
    });

    // Prevent duplicate animations for the same move
    const animKey = `${old.x},${old.y}->${newPos.x},${newPos.y}`;
    if (this.scene.animatingTiles.has(animKey)) {
        console.log('⚠️ Animation already in progress for this exact move');
        return;
    }
    
    this.scene.animatingTiles.add(animKey);

    // Remove ALL instances of this tile from the tilemap
    this.scene.moveableLayer.forEachTile(tile => {
        if (tile && tile.index === tileIndex) {
            this.scene.moveableLayer.removeTileAt(tile.x, tile.y);
        }
    });

    const tileWorldStart = this.gridToWorldPosition(old.x, old.y, true);
    const tileWorldEnd = this.gridToWorldPosition(newPos.x, newPos.y, true);
    
    console.log(`🎬 Animating from world pos (${tileWorldStart.x},${tileWorldStart.y}) to (${tileWorldEnd.x},${tileWorldEnd.y})`);
    
    // Create temporary sprite for animation
    const tileset = this.scene.map.tilesets[0];
    const tileTextureKey = tileset.image.key;
    const columns = tileset.columns;
    const frameIndex = tileIndex - tileset.firstgid;
    
    const frameX = (frameIndex % columns) * tileset.tileWidth;
    const frameY = Math.floor(frameIndex / columns) * tileset.tileHeight;

    const uniqueKey = `moving_tile_${Date.now()}_${Math.random()}`;
    const texture = this.scene.textures.get(tileTextureKey);
    const source = texture.getSourceImage();

    const canvas = document.createElement('canvas');
    canvas.width = tileset.tileWidth;
    canvas.height = tileset.tileHeight;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(
        source, 
        frameX, frameY, 
        tileset.tileWidth, tileset.tileHeight,
        0, 0, 
        tileset.tileWidth, tileset.tileHeight
    );

    this.scene.textures.addCanvas(uniqueKey, canvas);

    const tempTileSprite = this.scene.add.sprite(tileWorldStart.x, tileWorldStart.y, uniqueKey);
    tempTileSprite.setOrigin(0.5, 0.5);
    tempTileSprite.setDepth(tileWorldStart.y);
    tempTileSprite.tileIndex = tileIndex; // Track which tile this sprite represents
    
    // Store the sprite reference
    this.scene.tileAnimationSprites.set(animKey, tempTileSprite);

    this.scene.tweens.add({
        targets: tempTileSprite,
        x: tileWorldEnd.x,
        y: tileWorldEnd.y,
        onUpdate: () => {
            if (tempTileSprite.active) {
                tempTileSprite.setDepth(tempTileSprite.y);
            }
        },
        duration: this.defaultMoveSpeed * 2 * 1.6,
        ease: 'Linear',
        onComplete: () => {
            console.log(`✅ Tile animation complete for move to (${newPos.x},${newPos.y})`);
            
            // Remove ALL instances of this tile from the tilemap first
            this.scene.moveableLayer.forEachTile(tile => {
                if (tile && tile.index === tileIndex) {
                    this.scene.moveableLayer.removeTileAt(tile.x, tile.y);
                }
            });
            
            // Place the tile at its final position
            if (this.scene.moveableLayer) {
                this.scene.moveableLayer.putTileAt(tileIndex, newPos.x, newPos.y);
                console.log(`✅ Placed tile ${tileIndex} at final position (${newPos.x},${newPos.y})`);
            }
            
            // Clean up
            if (tempTileSprite.active) {
                tempTileSprite.destroy();
            }
            this.scene.textures.remove(uniqueKey);
            
            // Remove from tracking
            if (this.scene.animatingTiles) {
                this.scene.animatingTiles.delete(animKey);
            }
            if (this.scene.tileAnimationSprites) {
                this.scene.tileAnimationSprites.delete(animKey);
            }
        }
    });
  }

  updateSpriteDirection(direction) {
    switch (direction) {
      case 'up-right':
        this.sprite.setTexture('cat2');
        this.sprite.setFlipX(false);
        break;
      case 'up-left':
        this.sprite.setTexture('cat2');
        this.sprite.setFlipX(true);
        break;
      case 'down-right':
        this.sprite.setTexture('cat1');
        this.sprite.setFlipX(false);
        break;
      case 'down-left':
        this.sprite.setTexture('cat1');
        this.sprite.setFlipX(true);
        break;
    }
  }
}