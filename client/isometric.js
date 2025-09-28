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
    this.sprite = scene.add.rectangle(0, 0, 16, 16, 0xff0000);
    this.updatePosition();
    
    // Movement speed
    this.moveSpeed = 500; // milliseconds per move
    this.isMoving = false;
  }

  // Set the tilemap reference so we can check tile data
  setTilemap(tilemap) {
    this.tilemap = tilemap;
  }

  // Check if a grid position has a valid tile (non-zero data)
  isValidTile(gridX, gridY) {
    if (!this.tilemap) return true; // If no tilemap, allow movement
    
    // Get the tile at this position
    const tile = this.tilemap.getTileAt(gridX, gridY, false, 'Tile Layer 1');
    
    console.log(`Checking tile at (${gridX}, ${gridY}):`, tile ? `index=${tile.index}` : 'null');
    
    // Return true if tile exists and has non-zero data
    return tile && tile.index > 0;
  }

  // Convert grid coordinates to world position for staggered maps
  gridToWorldPosition(gridX, gridY) {
    const tileWidth = 32;
    const tileHeight = 32;
    
    // Staggered isometric positioning
    let worldX = gridX * tileWidth;
    let worldY = gridY * (tileHeight / 2);
    
    // Offset every other row (stagger effect)
    if (gridY % 2 === 1) {
      worldX += tileWidth / 2;
    }
    
    return { x: worldX, y: worldY };
  }

  updatePosition() {
    const worldPos = this.gridToWorldPosition(this.gridX, this.gridY);
    // Center the view and add some offset
    this.sprite.setPosition(worldPos.x + 400, worldPos.y + 100);
  }

  moveToGridPosition(targetGridX, targetGridY) {
    if (this.isMoving) return;
    
    // TEMPORARY: Disable collision checking for testing
    // Comment out these lines once we figure out the tile checking
    /*
    // Check if the target position has a valid tile (non-zero data)
    if (!this.isValidTile(targetGridX, targetGridY)) {
      console.log(`Move blocked: No valid tile at (${targetGridX}, ${targetGridY})`);
      return;
    }
    */
    
    // Expanded bounds checking - allow some negative coordinates for isometric view
    if (targetGridX < -5 || targetGridX >= 35 || targetGridY < -5 || targetGridY >= 35) {
      console.log(`Move rejected: (${targetGridX}, ${targetGridY}) out of bounds`);
      return;
    }
    
    this.isMoving = true;
    const startWorldPos = this.gridToWorldPosition(this.gridX, this.gridY);
    const endWorldPos = this.gridToWorldPosition(targetGridX, targetGridY);
    
    // Smooth movement tween
    this.scene.tweens.add({
      targets: this.sprite,
      x: endWorldPos.x + 400,
      y: endWorldPos.y + 100,
      duration: this.moveSpeed,
      ease: 'Power2',
      onComplete: () => {
        this.isMoving = false;
        this.gridX = targetGridX;
        this.gridY = targetGridY;
        console.log(`Moved to: (${this.gridX}, ${this.gridY})`);
        
        // Check what tile we're on after moving
        this.isValidTile(this.gridX, this.gridY);
      }
    });
  }

  handleInput(cursors, wasd) {
    if (this.isMoving) return;

    let newGridX = this.gridX;
    let newGridY = this.gridY;

    // TRUE isometric movement - all directions are diagonal in grid coordinates
    // But we need to account for staggered adjacency
    const isOddRow = this.gridY % 2 === 1;

    if (cursors.up.isDown || wasd.W.isDown) {
      // Move to adjacent tile in the "up-left" diagonal direction
      if (isOddRow) {
        newGridX += 0;  // Odd rows don't shift X when going up-left
        newGridY -= 1;
      } else {
        newGridX -= 1;  // Even rows shift X when going up-left
        newGridY -= 1;
      }
      console.log('Moving UP-LEFT diagonal');
    }
    else if (cursors.down.isDown || wasd.S.isDown) {
      // Move to adjacent tile in the "down-right" diagonal direction  
      if (isOddRow) {
        newGridX += 1;  // Odd rows shift X when going down-right
        newGridY += 1;
      } else {
        newGridX += 0;  // Even rows don't shift X when going down-right
        newGridY += 1;
      }
      console.log('Moving DOWN-RIGHT diagonal');
    }
    else if (cursors.left.isDown || wasd.A.isDown) {
      // Move to adjacent tile in the "down-left" diagonal direction
      if (isOddRow) {
        newGridX += 0;  // Odd rows don't shift X when going down-left
        newGridY += 1;
      } else {
        newGridX -= 1;  // Even rows shift X when going down-left
        newGridY += 1;
      }
      console.log('Moving DOWN-LEFT diagonal');
    }
    else if (cursors.right.isDown || wasd.D.isDown) {
      // Move to adjacent tile in the "up-right" diagonal direction
      if (isOddRow) {
        newGridX += 1;  // Odd rows shift X when going up-right
        newGridY -= 1;
      } else {
        newGridX += 0;  // Even rows don't shift X when going up-right  
        newGridY -= 1;
      }
      console.log('Moving UP-RIGHT diagonal');
    }

    console.log(`Current: (${this.gridX}, ${this.gridY}) -> Target: (${newGridX}, ${newGridY})`);

    // Only move if position changed
    if (newGridX !== this.gridX || newGridY !== this.gridY) {
      this.moveToGridPosition(newGridX, newGridY);
    }
  }
}