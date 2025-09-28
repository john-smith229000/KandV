// main.js - Phaser 3 setup for Discord Activities
import Phaser from 'phaser';
import { IsometricPlayer } from './isometric.js';

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Create a simple colored rectangle for the player (for testing)
    this.load.image('player', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==');
    const tilesetImage = 'spritesheet.png'; // The PNG file for your tileset
    const tilemapJSON = 'testmap.json';  // The JSON file for your map

    // Load the tileset image
    // The first argument 'tiles' is a key we will use to refer to this image.
    this.load.image('tiles', `images/tiles/${tilesetImage}`);

    // Load the Tiled JSON map data
    // The first argument 'map' is a key we will use to refer to this map data.
    this.load.tilemapTiledJSON('map', `maps/${tilemapJSON}`);
    // You can uncomment this when you are ready to use the cat sprite
    // this.load.image('cat', '/images/cat.png');
  }

  create() {

    // Create a tilemap object from the loaded data
    const map = this.make.tilemap({ key: 'map' });

    // Add the tileset image to the map
    // The first name 'your_tileset_name_in_tiled' MUST MATCH the name
    // you gave the tileset inside the Tiled editor.
    // The second name 'tiles' is the key we used in preload().
    const tileset = map.addTilesetImage('your_tileset_name_in_tiled', 'tiles');

    // Create the layer from the map data.
    // 'Ground' must match the name of the layer you created in Tiled.
    const groundLayer = map.createLayer('Ground', tileset, 0, 0);

    // Use the IsometricPlayer class
    this.player = new IsometricPlayer(this, 0, 0);

    // Set up keyboard input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,S,A,D');

    // Debug: Add text to confirm scene is loaded
    this.add.text(10, 10, 'Game Loaded! Use WASD or arrows to move', {
      fontSize: '16px',
      fill: '#ffffff'
    });
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