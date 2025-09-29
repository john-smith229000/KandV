import './style.css';
import Phaser from 'phaser';
import { IsometricPlayer } from './isometric.js';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import { Joystick } from './joystick.js'; // Import the Joystick class
import VirtualJoystickPlugin from 'phaser3-rex-plugins/dist/rexvirtualjoystickplugin.min.js';

// Check if we're running in Discord
const urlParams = new URLSearchParams(window.location.search);
const isDiscordActivity = urlParams.has('frame_id');

// Discord SDK variables
let discordSdk = null;
let auth = null;

// Discord Setup Function
async function setupDiscordSdk() {
  // Skip Discord in local development
  if (!isDiscordActivity) {
    console.log('📝 Running in local development mode');
    return null;
  }

  console.log('🚀 Initializing Discord SDK...');
  discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
  
  await discordSdk.ready();

  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify', 'guilds'],
  });

  const response = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  
  const { access_token } = await response.json();

  auth = await discordSdk.commands.authenticate({ access_token });
  if (auth == null) {
    throw new Error('Authentication failed');
  }
  
  console.log('✅ Discord SDK initialized!');
  return auth;
}

// Game Scene
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Load your tileset image
    this.load.image('tiles', '/images/tiles/isometric tileset/spritesheet.png');

    // Load the Tiled JSON map data (fixed double slash)
    this.load.tilemapTiledJSON('map', '/images/maps/testmap2.json');
    
    // Add loading event listeners for debugging
    this.load.on('filecomplete', (key, type, data) => {
      console.log('File loaded:', type, key);
    });
    
    this.load.on('loaderror', (file) => {
      console.error('Failed to load:', file.key, file.url);
      console.error('Make sure this file exists in client/public/', file.url);
    });
  }

  create() {
    try {
      // Create a tilemap object from the loaded data
      const map = this.make.tilemap({ key: 'map' });

      // Add the tileset image to the map
      const tileset = map.addTilesetImage('spritesheet', 'tiles');

      // Create the layer from the map data
      const groundLayer = map.createLayer('Tile Layer 1', tileset, 0, 0);

      // Use the IsometricPlayer class
      this.player = new IsometricPlayer(this, 12, 18);
      
      // Give the player access to the tilemap for collision detection
      this.player.setTilemap(map);

      this.cameras.main.startFollow(this.player.sprite, true);

      // Set up keyboard input
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys('W,S,A,D');

      // Create the joystick for touch controls
       this.joystick = new Joystick(this, 700, 500);

      // Add UI text
      const modeText = isDiscordActivity ? '🎮 Discord Mode' : '💻 Local Development';
      this.add.text(10, 10, modeText, {
        fontSize: '14px',
        fill: '#00ff00'
      });

      // Check if the device is a touch device (mobile, tablet, etc.)
     this.joystick = null;

      // This is a more robust check for a mobile device.
      // It checks if the primary input is a 'coarse' pointer (like a finger)
      // and not a 'fine' pointer (like a mouse).
      const isMobile = window.matchMedia("(pointer: coarse)").matches;

      if (isMobile) {
        console.log('Mobile device detected, creating joystick.');
        this.joystick = new Joystick(this, 700, 500);
        this.joystick.setVisible(true); // Make the joystick visible
        
        this.add.text(10, 35, 'Use the joystick to move', {
          fontSize: '16px',
          fill: '#ffffff'
        });
      } else {
        console.log('Desktop device detected, hiding joystick.');
        this.add.text(10, 35, 'Use WASD or arrows to move', {
          fontSize: '16px',
          fill: '#ffffff'
        });
      }

      // Debug: Log map information
      console.log('Map loaded:', map);
      console.log('Tileset loaded:', tileset);
      console.log('Ground layer created:', groundLayer);
      
    } catch (error) {
      console.error('Error creating game:', error);
      this.add.text(400, 300, 'Error loading game. Check console.', {
        fontSize: '20px',
        fill: '#ff0000'
      }).setOrigin(0.5);
    }
  }

  update(time, delta) {
    // Handle player movement
    if (this.player) {
      // Keyboard controls will always work
      this.player.handleInput(this.cursors, this.wasd);
      
      // Only handle joystick input if the joystick exists
      if (this.joystick) {
        this.player.handleJoystickInput(this.joystick);
      }
    }
  }
}

// Game configuration
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  backgroundColor: '#2c3e50',
  scene: GameScene,
  plugins: {
    global: [ // Register the plugin globally
      {
        key: 'rexVirtualJoystick',
        plugin: VirtualJoystickPlugin,
        start: true
      }
    ]
  },
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

// Start the application
async function startApp() {
  try {
    // Try Discord setup only if we're in Discord
    await setupDiscordSdk();
  } catch (error) {
    // This is normal for local development - not a real error
    if (isDiscordActivity) {
      console.error('Discord SDK error:', error);
    }
  }
  
  // Always start the game, regardless of Discord
  console.log('🎮 Starting Phaser game...');
  const game = new Phaser.Game(config);
}

// Start everything
startApp();

export default {};