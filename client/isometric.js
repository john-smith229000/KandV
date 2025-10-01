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


// Updated player class for staggered maps with collision detection
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
    
    this.moveToGridPosition(targetGridX, targetGridY, direction);
  }

 moveToGridPosition(targetGridX, targetGridY, direction) {
    if (this.isMoving || document.hidden) return;

    let isPushing = false;
    // Check if the scene and the moveable layer exist before trying to get a tile
    if (this.scene && this.scene.moveableLayer) {
        const moveableTile = this.scene.moveableLayer.getTileAt(targetGridX, targetGridY, true);
        if (moveableTile && moveableTile.index !== -1) {
            isPushing = true;
            let pushDeltaX = 0;
            let pushDeltaY = 0;
            const isOddRow = targetGridY % 2 === 1;
            switch(direction) {
                case 'up-left': pushDeltaY = -1; pushDeltaX = isOddRow ? 0 : -1; break;
                case 'up-right': pushDeltaY = -1; pushDeltaX = isOddRow ? 1 : 0; break;
                case 'down-right': pushDeltaY = 1; pushDeltaX = isOddRow ? 1 : 0; break;
                case 'down-left': pushDeltaY = 1; pushDeltaX = isOddRow ? 0 : -1; break;
            }
            const pushToX = targetGridX + pushDeltaX;
            const pushToY = targetGridY + pushDeltaY;

            const groundTileAtTarget = this.tilemap.getTileAt(pushToX, pushToY, true, 'Ground');
            const bridgeTileAtTarget = this.tilemap.getLayer('Bridge') ? this.tilemap.getTileAt(pushToX, pushToY, true, 'Bridge') : null;
            const isBridgePresent = bridgeTileAtTarget && bridgeTileAtTarget.index !== -1;
            const isWater = !isBridgePresent && groundTileAtTarget && groundTileAtTarget.properties.water === "1";
            const destinationTile = this.scene.moveableLayer.getTileAt(pushToX, pushToY, true);
            if (this.isValidTile(pushToX, pushToY) && (!destinationTile || destinationTile.index === -1) && !isWater) {
                const moveData = { old: { x: targetGridX, y: targetGridY }, new: { x: pushToX, y: pushToY }, tileIndex: moveableTile.index };
                this.socket.emit('moveableTileMoved', moveData);
                this.moveSpeed = this.defaultMoveSpeed * 2;
            } else {
                return; // Blocked
            }
        }
    }

    if (!isPushing) {
        if (!this.isValidTile(targetGridX, targetGridY)) {
            return;
        }
        this.moveSpeed = this.defaultMoveSpeed;

        const bridgeTile = this.tilemap.getLayer('Bridge') ? this.tilemap.getTileAt(targetGridX, targetGridY, true, 'Bridge') : null;
        const groundTile = this.tilemap.getLayer('Ground') ? this.tilemap.getTileAt(targetGridX, targetGridY, true, 'Ground') : null;
        
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

  animateTilePush(data) {
    const { old, new: newPos, tileIndex } = data;

    if (document.hidden) {
        if (this.scene.moveableLayer) {
            this.scene.moveableLayer.removeTileAt(old.x, old.y);
            this.scene.moveableLayer.putTileAt(tileIndex, newPos.x, newPos.y);
        }
        return;
    }

    const animKey = `${old.x},${old.y}->${newPos.x},${newPos.y}`;
    if (this.scene.animatingTiles && this.scene.animatingTiles.has(animKey)) {
        return;
    }
    
    if (!this.scene.animatingTiles) this.scene.animatingTiles = new Set();
    this.scene.animatingTiles.add(animKey);

    this.scene.moveableLayer.removeTileAt(old.x, old.y);
    this.scene.moveableLayer.removeTileAt(newPos.x, newPos.y);

    const tileWorldStart = this.gridToWorldPosition(old.x, old.y, true);
    const tileWorldEnd = this.gridToWorldPosition(newPos.x, newPos.y, true);
    
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
                this.scene.moveableLayer.putTileAt(tileIndex, newPos.x, newPos.y);
            }
            
            tempTileSprite.destroy();
            this.scene.textures.remove(uniqueKey);
            
            this.scene.animatingTiles.delete(animKey);
            
            if (this.socket) {
                this.socket.emit('tileAnimationComplete');
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