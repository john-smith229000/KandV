// main.js - Phaser 3 setup for Discord Activities
import Phaser from 'phaser';

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Create a simple colored rectangle for the player (for testing)
    this.load.image('player', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==');
    
    // Load your cat sprite when ready
    // this.load.image('cat', '/images/cat.png');
  }

  create() {
    // Create a red rectangle graphics for the player
    const graphics = this.add.graphics();
    graphics.fillStyle(0xff0000);
    graphics.fillRect(0, 0, 32, 32);
    graphics.generateTexture('playerRect', 32, 32);
    graphics.destroy(); // Clean up the graphics object

    // Create player sprite using the generated texture
    this.player = this.add.sprite(400, 300, 'playerRect');
    this.player.setOrigin(0.5, 0.5);

    // Set up keyboard input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,S,A,D');

    // Player movement properties
    this.playerSpeed = 150;

    // Debug: Add text to confirm scene is loaded
    this.add.text(10, 10, 'Game Loaded! Use WASD or arrows to move red square', {
      fontSize: '16px',
      fill: '#ffffff'
    });
  }

  create() {
    // Create player sprite
    this.player = this.add.sprite(400, 300, 'player');
    this.player.setOrigin(0.5, 0.5);

    // Set up keyboard input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,S,A,D');

    // Player movement properties
    this.playerSpeed = 150;
  }

  update(time, delta) {
    // Handle player movement
    let velocityX = 0;
    let velocityY = 0;

    // Check input
    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      velocityX = -this.playerSpeed;
    }
    if (this.cursors.right.isDown || this.wasd.D.isDown) {
      velocityX = this.playerSpeed;
    }
    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      velocityY = -this.playerSpeed;
    }
    if (this.cursors.down.isDown || this.wasd.S.isDown) {
      velocityY = this.playerSpeed;
    }

    // Normalize diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.7071; // 1/sqrt(2)
      velocityY *= 0.7071;
    }

    // Use the correct texture name
    this.player.x += velocityX * (delta / 1000);
    this.player.y += velocityY * (delta / 1000);
  }
}

// Game configuration
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game', // This should match your HTML element ID
  backgroundColor: '#2c3e50',
  scene: GameScene,
  render: {
    pixelArt: true,     // Perfect for isometric pixel art
    antialias: false,   // Sharp pixels
    roundPixels: true   // Prevents sub-pixel rendering
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

// Create and start the game
const game = new Phaser.Game(config);

export default game;