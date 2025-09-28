// main.js - Phaser 3 setup for Discord Activities
import Phaser from 'phaser';
import { IsometricPlayer } from './isometric.js';

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Load your actual tileset image
    this.load.image('tiles', '/images/tiles/isometric tileset/spritesheet.png');

    // Load the Tiled JSON map data  
    this.load.tilemapTiledJSON('map', 'images//maps/testmap2.json');
    
    // Add loading event listeners for debugging
    this.load.on('filecomplete', (key, type, data) => {
      console.log('File loaded:', type, key);
    });
    
    this.load.on('loaderror', (file) => {
      console.error('Failed to load:', file.key, file.url);
    });
    
    // You can uncomment this when you are ready to use the cat sprite
    // this.load.image('cat', '/images/cat.png');
  }

  create() {
    // Create a tilemap object from the loaded data
    const map = this.make.tilemap({ key: 'map' });

    // Add the tileset image to the map
    // The name 'spritesheet' now matches what's in our JSON file
    const tileset = map.addTilesetImage('spritesheet', 'tiles');

    // Create the layer from the map data
    // Use the actual layer name from your JSON: "Tile Layer 1"
    const groundLayer = map.createLayer('Tile Layer 1', tileset, 0, 0);

    // Optional: Set the layer scale if you want it bigger/smaller
    // groundLayer.setScale(2);

    // Use the IsometricPlayer class - spawn on a tile with data (around 15, 18)
    this.player = new IsometricPlayer(this, 2, 12);
    
    // Give the player access to the tilemap for collision detection
    this.player.setTilemap(map);

    // Set up keyboard input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,S,A,D');

    // Debug: Add text to confirm scene is loaded
    this.add.text(10, 10, 'Game Loaded! Use WASD or arrows to move', {
      fontSize: '16px',
      fill: '#ffffff'
    });

    // Debug: Log map information
    console.log('Map loaded:', map);
    console.log('Tileset loaded:', tileset);
    console.log('Ground layer created:', groundLayer);
  }

  update(time, delta) {
    // Handle player movement using the method from IsometricPlayer
    this.player.handleInput(this.cursors, this.wasd);
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
    pixelArt: true,
    antialias: false,
    roundPixels: true
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

// Create and start the game
const game = new Phaser.Game(config);

export default game;