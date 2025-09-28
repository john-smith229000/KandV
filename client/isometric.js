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

// Example usage for isometric movement
export class IsometricPlayer {
  constructor(scene, startIsoX = 0, startIsoY = 0) {
    this.scene = scene;
    this.isoHelper = new IsometricHelper();
    
    // Isometric position
    this.isoX = startIsoX;
    this.isoY = startIsoY;
    
    // Create sprite
    this.sprite = scene.add.rectangle(0, 0, 32, 32, 0xff0000);
    this.updatePosition();
    
    // Movement speed
    this.moveSpeed = 2; // tiles per second
    this.isMoving = false;
  }

  updatePosition() {
    const screenPos = this.isoHelper.isoToScreen(this.isoX, this.isoY);
    this.sprite.setPosition(screenPos.x + 400, screenPos.y + 200); // Center on screen
  }

  moveToIsoPosition(targetIsoX, targetIsoY) {
    if (this.isMoving) return;
    
    this.isMoving = true;
    const startX = this.isoX;
    const startY = this.isoY;
    
    // Smooth movement tween
    this.scene.tweens.add({
      targets: this,
      isoX: targetIsoX,
      isoY: targetIsoY,
      duration: 1000 / this.moveSpeed,
      ease: 'Power2',
      onUpdate: () => {
        this.updatePosition();
      },
      onComplete: () => {
        this.isMoving = false;
        this.isoX = targetIsoX;
        this.isoY = targetIsoY;
      }
    });
  }

  handleInput(cursors, wasd) {
    if (this.isMoving) return;

    let newIsoX = this.isoX;
    let newIsoY = this.isoY;

    // Isometric movement directions
    if (cursors.up.isDown || wasd.W.isDown) {
      newIsoY -= 1; // Move north
    }
    if (cursors.down.isDown || wasd.S.isDown) {
      newIsoY += 1; // Move south
    }
    if (cursors.left.isDown || wasd.A.isDown) {
      newIsoX -= 1; // Move west
    }
    if (cursors.right.isDown || wasd.D.isDown) {
      newIsoX += 1; // Move east
    }

    // Only move if position changed
    if (newIsoX !== this.isoX || newIsoY !== this.isoY) {
      this.moveToIsoPosition(newIsoX, newIsoY);
    }
  }
}