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

  // Get the screen position for a tile at iso coordinates
  getTilePosition(isoX, isoY, offsetX = 0, offsetY = 0) {
    const screen = this.isoToScreen(isoX, isoY);
    return {
      x: screen.x + offsetX,
      y: screen.y + offsetY
    };
  }

  // Create an isometric diamond shape (for tile highlights)
  createDiamondShape(scene, x, y, color = 0x00ff00, alpha = 0.5) {
    const graphics = scene.add.graphics();
    graphics.fillStyle(color, alpha);
    graphics.fillRoundedRect(
      x - this.tileWidth / 2, 
      y - this.tileHeight / 2,
      this.tileWidth, 
      this.tileHeight, 
      8
    );
    return graphics;
  }
}


// Updated player class for staggered maps with collision detection
export class IsometricPlayer {
  constructor(scene, startIsoX = 13, startIsoY = 11, socket) {
    this.scene = scene;
    this.socket = socket;
    this.tilemap = null;
    this.waterSound = null;
    
    // Grid position (in tile coordinates)
    this.gridX = startIsoX;
    this.gridY = startIsoY;
    
    
    // Create sprite
    this.sprite = scene.add.sprite(0, 0, 'cat1').setScale(0.3).setOrigin(0.35, 0.75);

    // Give the sprite a physics body
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setCircle(35); 
    this.sprite.body.setOffset(0, 0); 

    // DON'T update position yet - tilemap isn't set!
    // this.updatePosition();  // REMOVE THIS LINE
    
    // Movement speed
    this.defaultMoveSpeed = 125;
    this.moveSpeed = this.defaultMoveSpeed;
    this.isMoving = false;
}

setTilemap(tilemap) {
    this.tilemap = tilemap;
    this.updatePosition();  // Now update position since we have the tilemap
}

isValidTile(gridX, gridY) {
    if (!this.tilemap) return true;

    const mapWidth = this.tilemap.width;
    const mapHeight = this.tilemap.height;

    // Explicit bounds check
    if (gridX < 0 || gridY < 0 || gridX >= mapWidth || gridY >= mapHeight) {
        console.log(`Out of bounds: (${gridX}, ${gridY})`);
        return false;
    }

    // Check by tile coordinates - this uses the map's grid, not world positions
    const layerData = this.tilemap.getLayer('Ground').data;
    const row = layerData[gridY];
    const tileAtCoords = row ? row[gridX] : null;
    const validCoords = !!tileAtCoords && tileAtCoords.index !== -1;

    console.log(`Checking tile at (${gridX}, ${gridY}) -> tile:${tileAtCoords ? tileAtCoords.index : 'null'}`);

    return validCoords;
}

  // Convert grid coordinates to world position for rendering
  // This uses the MAP'S built-in conversion to handle the staggered layout correctly
gridToWorldPosition(gridX, gridY, center = true) {
    if (!this.tilemap) {
        return { x: gridX * 32, y: gridY * 16 };
    }

    // Get the raw world position from Phaser
    let worldPos = this.tilemap.tileToWorldXY(gridX, gridY);
    
    if (!worldPos) {
        console.error(`Failed to convert grid(${gridX}, ${gridY}) to world position`);
        return { x: 0, y: 0 };
    }
    
    // Log what Phaser gives us
    console.log(`Phaser tileToWorldXY for (${gridX}, ${gridY}): (${worldPos.x}, ${worldPos.y})`);
    
    if (center) {
        // For staggered isometric maps, the centering needs to account for the actual tile dimensions
        // The visual tile is 32x32, but the map uses tileHeight: 16 for overlap
        worldPos.x += 32 / 2;  // Half of visual tile width
        worldPos.y += 32 / 2;  // Half of visual tile height (not map's tileHeight!)
    }
    
    return worldPos;
}

updatePosition() {
    const worldPos = this.gridToWorldPosition(this.gridX, this.gridY);
    console.log(`Updating position: grid(${this.gridX}, ${this.gridY}) -> world(${worldPos.x}, ${worldPos.y})`);
    this.sprite.setPosition(worldPos.x, worldPos.y);
    this.sprite.setDepth(worldPos.y);
}

  animateTilePush(data) {
    const { old, new: newPos, tileIndex } = data;

    if (document.hidden) {
        if (this.scene.moveableLayer) {
            this.scene.moveableLayer.removeTileAt(old.x, old.y);
            this.scene.moveableLayer.putTileAt(tileIndex, newPos.x, newPos.y);
        }
        return;
    }

    // Check if we're already animating this tile
    const animKey = `${old.x},${old.y}->${newPos.x},${newPos.y}`;
    if (this.scene.animatingTiles && this.scene.animatingTiles.has(animKey)) {
        return; // Don't double-animate
    }
    
    // Track that we're animating this tile
    if (!this.scene.animatingTiles) this.scene.animatingTiles = new Set();
    this.scene.animatingTiles.add(animKey);

    // Remove tile from BOTH positions to prevent ghosts
    this.scene.moveableLayer.removeTileAt(old.x, old.y);
    this.scene.moveableLayer.removeTileAt(newPos.x, newPos.y);

    // Animate the tile being pushed
    const tileWorldStart = this.gridToWorldPosition(old.x, old.y, true);
    const tileWorldEnd = this.gridToWorldPosition(newPos.x, newPos.y, true);
    
    const tileset = this.scene.map.tilesets[0];
    const tileTextureKey = tileset.image.key;
    const columns = tileset.columns;
    const frameIndex = tileIndex - tileset.firstgid;
    
    // Calculate frame position in the tileset
    const frameX = (frameIndex % columns) * tileset.tileWidth;
    const frameY = Math.floor(frameIndex / columns) * tileset.tileHeight;

    const uniqueKey = `moving_tile_${Date.now()}_${Math.random()}`;
    const texture = this.scene.textures.get(tileTextureKey);
    const source = texture.getSourceImage();

    // Create canvas with the tileset's tile dimensions
    const canvas = document.createElement('canvas');
    canvas.width = tileset.tileWidth;
    canvas.height = tileset.tileHeight;
    const ctx = canvas.getContext('2d');
    
    // Draw the tile at its native size (no stretching)
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
    // Place the tile at its final position
    if (this.scene.moveableLayer) {
        this.scene.moveableLayer.putTileAt(tileIndex, newPos.x, newPos.y);
    }
    
    // Clean up
    tempTileSprite.destroy();
    this.scene.textures.remove(uniqueKey);
    
    // Remove from animating set
    this.scene.animatingTiles.delete(animKey);
    
    // Tell server to sync the final state now that animation is done
    if (this.socket) {
        this.socket.emit('tileAnimationComplete');
    }
}
    });
}

  moveToGridPosition(targetGridX, targetGridY, direction) {
    console.log('moveToGridPosition called:');
    console.log('  Current grid:', this.gridX, this.gridY);
    console.log('  Target grid:', targetGridX, targetGridY);
    console.log('  Direction:', direction);
    if (this.isMoving) return;
    if (document.hidden) return;

    // Check if there's a moveable tile at the target position
    // Use getTileAt with grid coordinates - this works with the map's internal grid
    const moveableTile = this.scene.moveableLayer ? 
      this.scene.moveableLayer.getTileAt(targetGridX, targetGridY, true) : null;
    
    let isPushing = false;

    if (this.scene.moveableLayer && moveableTile && moveableTile.index !== -1) {
      isPushing = true;
      
      let pushDeltaX = 0;
      let pushDeltaY = 0;
      
      switch(direction) {
        case 'up-left': pushDeltaY = -1; pushDeltaX = (targetGridY % 2 === 1) ? 0 : -1; break;
        case 'up-right': pushDeltaY = -1; pushDeltaX = (targetGridY % 2 === 1) ? 1 : 0; break;
        case 'down-right': pushDeltaY = 1; pushDeltaX = (targetGridY % 2 === 1) ? 1 : 0; break;
        case 'down-left': pushDeltaY = 1; pushDeltaX = (targetGridY % 2 === 1) ? 0 : -1; break;
      }
      
      const pushToX = targetGridX + pushDeltaX;
      const pushToY = targetGridY + pushDeltaY;

      // Check if the destination tile is water - use grid coordinates
      const groundTileAtTarget = this.tilemap.getTileAt(pushToX, pushToY, true, 'Ground');
      const bridgeTileAtTarget = this.tilemap.getTileAt(pushToX, pushToY, true, 'Bridge');
      const isBridgePresent = bridgeTileAtTarget && bridgeTileAtTarget.index !== -1;
      const isWater = !isBridgePresent && groundTileAtTarget && groundTileAtTarget.properties.water === "1";

      // Check if the destination is valid, empty, AND not water
      const destinationTile = this.scene.moveableLayer.getTileAt(pushToX, pushToY, true);
      if (this.isValidTile(pushToX, pushToY) && (!destinationTile || destinationTile.index === -1) && !isWater) {
        const moveData = {
          old: { x: targetGridX, y: targetGridY },
          new: { x: pushToX, y: pushToY },
          tileIndex: moveableTile.index
        };
        
        this.socket.emit('moveableTileMoved', moveData);
        this.animateTilePush(moveData);
        this.moveSpeed = this.defaultMoveSpeed * 2;
      } else {
        console.log('Push blocked: destination invalid or water');
        return; // Blocked
      }
    } else {
      if (!this.isValidTile(targetGridX, targetGridY)) {
        return;
      }
      this.moveSpeed = this.defaultMoveSpeed;
    }

    // Water speed and sound check - use grid coordinates
    if (!isPushing) {
      const bridgeTile = this.tilemap.getTileAt(targetGridX, targetGridY, true, 'Bridge');
      const groundTile = this.tilemap.getTileAt(targetGridX, targetGridY, true, 'Ground');
      const isBridgePresent = bridgeTile && bridgeTile.index !== -1;
      const isWater = !isBridgePresent && groundTile && groundTile.properties.water === "1";

      if (isWater) {
        this.moveSpeed = this.defaultMoveSpeed * 2.0;
        if (!this.waterSound || !this.waterSound.isPlaying) {
          if (!this.waterSound) {
            this.waterSound = this.scene.sound.add('water_sound', { loop: true });
          }
          this.waterSound.play();
          const duration = this.waterSound.duration;
          if (duration > 0) {
            const randomStart = Math.random() * duration;
            this.waterSound.seek = randomStart;
          }
        }
      } else {
        if (this.waterSound && this.waterSound.isPlaying) {
          this.waterSound.stop();
        }
      }
    } else {
      if (this.waterSound && this.waterSound.isPlaying) {
        this.waterSound.stop();
      }
    }

    // Player movement tween
    this.isMoving = true;
    this.updateSpriteDirection(direction);
    const endWorldPos = this.gridToWorldPosition(targetGridX, targetGridY, true);

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

        if (this.socket) {
          this.socket.emit('playerMovement', { x: this.gridX, y: this.gridY, direction: direction });
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

  handleInput(cursors, wasd) {
    if (this.isMoving) return;

    let newGridX = this.gridX;
    let newGridY = this.gridY;
    let direction = null;
    const isOddRow = this.gridY % 2 === 1;

    if (cursors.up.isDown || wasd.W.isDown) {
      direction = 'up-left';
      newGridY--;
      newGridX = this.gridX - (isOddRow ? 0 : 1);
    } else if (cursors.right.isDown || wasd.D.isDown) {
      direction = 'up-right';
      newGridY--;
      newGridX = this.gridX + (isOddRow ? 1 : 0);
    } else if (cursors.down.isDown || wasd.S.isDown) {
      direction = 'down-right';
      newGridY++;
      newGridX = this.gridX + (isOddRow ? 1 : 0);
    } else if (cursors.left.isDown || wasd.A.isDown) {
      direction = 'down-left';
      newGridY++;
      newGridX = this.gridX - (isOddRow ? 0 : 1);
    }

   if (direction) {
        console.log('Input detected - calculated new position:', newGridX, newGridY, 'from', this.gridX, this.gridY);
        this.moveToGridPosition(newGridX, newGridY, direction);
    }
  }

  handleJoystickInput(joystickCursors) {
    if (this.isMoving || !joystickCursors) return;

    let newGridX = this.gridX;
    let newGridY = this.gridY;
    let direction = null;
    const isOddRow = this.gridY % 2 === 1;

    const up = joystickCursors.up.isDown;
    const down = joystickCursors.down.isDown;
    const left = joystickCursors.left.isDown;
    const right = joystickCursors.right.isDown;

    if (up && left) {
      direction = 'up-left';
      newGridY--;
      newGridX = this.gridX - (isOddRow ? 0 : 1);
    } else if (up && right) {
      direction = 'up-right';
      newGridY--;
      newGridX = this.gridX + (isOddRow ? 1 : 0);
    } else if (down && right) {
      direction = 'down-right';
      newGridY++;
      newGridX = this.gridX + (isOddRow ? 1 : 0);
    } else if (down && left) {
      direction = 'down-left';
      newGridY++;
      newGridX = this.gridX - (isOddRow ? 0 : 1);
    }

    if (direction) {
      this.moveToGridPosition(newGridX, newGridY, direction);
    }
  }
}