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
  constructor(scene, startIsoX = 15, startIsoY = 18) { // Start on a tile with data
    this.scene = scene;
    this.tilemap = null; // Will be set from the scene
    
    // Grid position (in tile coordinates) - start on a visible tile
    this.gridX = startIsoX;
    this.gridY = startIsoY;
    
    // Create sprite - change the size here (width, height)
    this.sprite = scene.add.sprite(0, 0, 'cat1').setScale(0.3).setOrigin(0.35, 0.75);
    this.updatePosition();
    
    // Movement speed
    this.moveSpeed = 100; // milliseconds per move
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
    const layerData = this.tilemap.getLayer('Tile Layer 1').data;
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
          'Tile Layer 1'
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
  }

  // --- Move to grid position using world CENTER and collision check ---
  moveToGridPosition(targetGridX, targetGridY, direction) {
    if (this.isMoving) return;
    if (!this.isValidTile(targetGridX, targetGridY)) {
      return;
    }

    this.isMoving = true;
    
    // Set sprite direction BEFORE the tween starts
    this.updateSpriteDirection(direction);

    const endWorldPos = this.gridToWorldPosition(targetGridX, targetGridY, true);

    this.scene.tweens.add({
      targets: this.sprite,
      x: endWorldPos.x,
      y: endWorldPos.y,
      duration: this.moveSpeed * 1.6,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.isMoving = false;
        this.gridX = targetGridX;
        this.gridY = targetGridY;
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

  handleJoystickInput(joystick) {
    if (this.isMoving || !joystick) return;

    let newGridX = this.gridX;
    let newGridY = this.gridY;
    let direction = null;
    const isOddRow = this.gridY % 2 === 1;

    const up = joystick.isDirectionDown('up');
    const down = joystick.isDirectionDown('down');
    const left = joystick.isDirectionDown('left');
    const right = joystick.isDirectionDown('right');

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