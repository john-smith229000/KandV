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
  constructor(scene, startIsoX = 15, startIsoY = 18, socket) { // Start on a tile with data
    this.scene = scene;
    this.socket = socket;
    this.tilemap = null; // Will be set from the scene
    
    // Grid position (in tile coordinates) - start on a visible tile
    this.gridX = startIsoX;
    this.gridY = startIsoY;
    
    // Create sprite - change the size here (width, height)
    this.sprite = scene.add.sprite(0, 0, 'cat1').setScale(0.3).setOrigin(0.35, 0.75);

    // 1. Give the sprite a physics body
    scene.physics.add.existing(this.sprite);

    // 2. Adjust the physics body to be a smaller circle at the player's feet
    //    This prevents the large, transparent parts of the sprite from triggering overlaps.
    //    setCircle(radius)
    this.sprite.body.setCircle(35); 
    //    setOffset(x, y) to center the new circle
    this.sprite.body.setOffset(55, 130); 

    this.updatePosition();
    
    // Movement speed
    this.defaultMoveSpeed = 125; // milliseconds per move
    this.moveSpeed = this.defaultMoveSpeed;
    this.isMoving = false;


  }

  // Set the tilemap reference so we can check tile data
  setTilemap(tilemap) {
    this.tilemap = tilemap;
  }

    // --- Robust tile check: bounds + coord lookup + world-sampling fallback ---
  isValidTile(gridX, gridY) {
    if (!this.tilemap) return true;

    const mapWidth = this.tilemap.width;
    const mapHeight = this.tilemap.height;

    // explicit bounds check
    if (gridX < 0 || gridY < 0 || gridX >= mapWidth || gridY >= mapHeight) {
      console.log(`Out of bounds: (${gridX}, ${gridY})`);
      return false;
    }

    // 1) check by tile coordinates (safe access; avoid falsy-0 bug)
    const layerData = this.tilemap.getLayer('Ground').data;
    const row = layerData[gridY];
    const tileAtCoords = row ? row[gridX] : null;
    const validCoords = !!tileAtCoords && tileAtCoords.index !== -1;

    // 2) also sample the tile at the *world center* of that grid cell using Phaser API,
    //    this is important for staggered/isometric maps so we check the exact tile under the sprite.
    let tileAtWorld = null;
    if (typeof this.tilemap.getTileAtWorldXY === 'function') {
      const center = this.gridToWorldPosition(gridX, gridY, true);
      // getTileAtWorldXY(worldX, worldY, nonNull=false, camera?, layer?)
      try {
        tileAtWorld = this.tilemap.getTileAtWorldXY(
          center.x, center.y,
          false,
          (this.scene && this.scene.cameras && this.scene.cameras.main) ? this.scene.cameras.main : undefined,
          'Ground'
        );
      } catch (e) {
        // some Phaser builds accept different params — ignore and fallback to coord check
        tileAtWorld = null;
      }
    }

    const validWorld = (tileAtWorld === null) ? true : (tileAtWorld && tileAtWorld.index !== -1);

    console.log(
      `Checking tile at (${gridX}, ${gridY}) -> coords:${tileAtCoords ? tileAtCoords.index : 'null'} world:${tileAtWorld ? tileAtWorld.index : 'null'}`
    );

    // require both checks to pass when world-sampling is available
    return validCoords && validWorld;
  }

  // --- Convert grid -> world (returns tile CENTER by default) ---
  gridToWorldPosition(gridX, gridY, center = true) {
    // Prefer map's tile size if available
    const tileWidth = this.tilemap ? this.tilemap.tileWidth : 32;
    const tileHeight = this.tilemap ? this.tilemap.tileHeight : 32;

    let worldX = gridX * tileWidth;
    let worldY = gridY * (tileHeight / 2);

    // staggered (odd rows offset right)
    if (gridY % 2 === 1) {
      worldX += tileWidth / 2;
    }

    if (center) {
      // move to center of the tile so sampling / sprite origin match
      worldX += tileWidth / 2;
      worldY += tileHeight / 2;
    }

    return { x: worldX, y: worldY };
  }

  updatePosition() {
    const worldPos = this.gridToWorldPosition(this.gridX, this.gridY);
    this.sprite.setPosition(worldPos.x, worldPos.y);
    // Set depth based on y-coordinate for correct isometric sorting
    this.sprite.setDepth(worldPos.y);
  }


animateTilePush(data) {
    const { old, new: newPos, tileIndex } = data;

    // CRITICAL: Store the tile data BEFORE removing it
    const tileToMove = this.scene.moveableLayer ? this.scene.moveableLayer.getTileAt(old.x, old.y) : null;
    
    // Only proceed if there's actually a tile to move
    if (!tileToMove || tileToMove.index === -1) {
        console.warn('No tile found at position to animate:', old);
        return;
    }

    // Remove the tile from the old position ONLY after confirming it exists
    this.scene.moveableLayer.removeTileAt(old.x, old.y);

    // Animate the tile being pushed
    const tileWorldStart = this.gridToWorldPosition(old.x, old.y, true);
    const tileWorldEnd = this.gridToWorldPosition(newPos.x, newPos.y, true);
    
    const tileset = this.scene.map.tilesets[0];
    const tileTextureKey = tileset.image.key;
    const columns = tileset.columns;
    const frameIndex = tileIndex - tileset.firstgid;
    const frameX = (frameIndex % columns) * this.tilemap.tileWidth;
    const frameY = Math.floor(frameIndex / columns) * this.tilemap.tileHeight;

    const uniqueKey = `moving_tile_${Date.now()}_${Math.random()}`;  // More unique key
    const texture = this.scene.textures.get(tileTextureKey);
    const source = texture.getSourceImage();

    const canvas = document.createElement('canvas');
    canvas.width = this.tilemap.tileWidth;
    canvas.height = this.tilemap.tileHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, frameX, frameY, this.tilemap.tileWidth, this.tilemap.tileHeight, 0, 0, this.tilemap.tileWidth, this.tilemap.tileHeight);

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
            if (this.scene.moveableLayer) {
                // Place the tile at the new position
                this.scene.moveableLayer.putTileAt(tileIndex, newPos.x, newPos.y);
            }
            tempTileSprite.destroy();
            this.scene.textures.remove(uniqueKey);
        }
    });
}


  // --- Move to grid position using world CENTER and collision check ---
moveToGridPosition(targetGridX, targetGridY, direction) {
    if (this.isMoving) return;

    // Check if there's a moveable tile at the target position
    const moveableTile = this.scene.moveableLayer ? 
        this.scene.moveableLayer.getTileAt(targetGridX, targetGridY, true) : null;  // Add 'true' for nonNull
    
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

        // Check if the destination is valid AND empty
        const destinationTile = this.scene.moveableLayer.getTileAt(pushToX, pushToY, true);
        if (this.isValidTile(pushToX, pushToY) && (!destinationTile || destinationTile.index === -1)) {
            const moveData = {
                old: { x: targetGridX, y: targetGridY },
                new: { x: pushToX, y: pushToY },
                tileIndex: moveableTile.index
            };
            
            this.socket.emit('moveableTileMoved', moveData);
            
            // Call the animation function for the local player
            this.animateTilePush(moveData);

            this.moveSpeed = this.defaultMoveSpeed * 2;
        } else {
            return; // Blocked
        }
    } else {
        if (!this.isValidTile(targetGridX, targetGridY)) {
            return;
        }
        this.moveSpeed = this.defaultMoveSpeed;
    }

    

    // Water speed check
    if (!isPushing) {
        const bridgeTile = this.tilemap.getTileAt(targetGridX, targetGridY, true, 'Bridge');
        const groundTile = this.tilemap.getTileAt(targetGridX, targetGridY, true, 'Ground');
        const isBridgePresent = bridgeTile && bridgeTile.index !== -1;
        if (!isBridgePresent && groundTile && groundTile.properties.water === "1") {
            this.moveSpeed = this.defaultMoveSpeed * 1.5;
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
        // Add onUpdate to continually set the player's depth while moving
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
   // --- Updated Input Handlers ---
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
      this.moveToGridPosition(newGridX, newGridY, direction);
    }
  }

 handleJoystickInput(joystickCursors) {
    if (this.isMoving || !joystickCursors) return;

    let newGridX = this.gridX;
    let newGridY = this.gridY;
    let direction = null;
    const isOddRow = this.gridY % 2 === 1;

    // We now check the 'isDown' property directly on the cursor data
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