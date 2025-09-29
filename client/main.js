import './style.css';
import Phaser from 'phaser';
import { io } from 'socket.io-client';
import { IsometricPlayer } from './isometric.js';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import { Joystick } from './joystick.js';
import VirtualJoystickPlugin from 'phaser3-rex-plugins/dist/rexvirtualjoystickplugin.min.js';

// Discord variables and setup function (unchanged)
const urlParams = new URLSearchParams(window.location.search);
const isDiscordActivity = urlParams.has('frame_id');
let discordSdk = null;
let auth = null;
async function setupDiscordSdk() { /* ... same as before ... */ }

// --- NEW UI SCENE ---
// This scene's only job is to display text on top of the game.
class UIScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UIScene', active: true });
    }

    create() {
        const isMobile = window.matchMedia("(pointer: coarse)").matches;

        // Add the mode text
        const modeTextContent = isDiscordActivity ? '🎮 Discord Mode' : '💻 Local Development';
        this.add.text(10, 10, modeTextContent, {
            fontSize: '14px',
            fill: '#00ff00'
        });

        // Add the instruction text
        const instructionTextContent = isMobile ? 'Use the joystick to move' : 'Use WASD or arrows to move';
        this.add.text(10, 35, instructionTextContent, {
            fontSize: '16px',
            fill: '#ffffff'
        });

        // --- Sound Effect Logic ---
        if (isMobile) {
            // --- 1. Create the button for mobile ---
            // A circle graphic in the top-right corner.
            const meowButton = this.add.circle(1240, 40, 25, 0xcccccc, 0.8);
            
            // --- 2. Make it interactive ---
            meowButton.setInteractive();

            // --- 3. Add a click/touch listener ---
            meowButton.on('pointerdown', () => {
                this.sound.play('meow_sound');
                // Optional: visual feedback when pressed
                meowButton.setFillStyle(0xffffff, 1);
                this.time.delayedCall(100, () => {
                    meowButton.setFillStyle(0xcccccc, 0.8);
                });
            });

        } else {
            // --- For desktop, use the 'M' key ---
            const MKey = this.input.keyboard.addKey('M');
            MKey.on('down', () => {
                this.sound.play('meow_sound');
            });
        }
    }
}


// --- GAME SCENE (Updated) ---
// Now focused only on the game world, with all text code removed.
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        // Maps
        this.load.image('tiles', '/images/tiles/isometric tileset/spritesheet.png');
        this.load.tilemapTiledJSON('map', '/images/maps/testmap2.json');

        // Load the new character sprites
        this.load.image('cat1', '/images/actors/cat1.png');
        this.load.image('cat2', '/images/actors/cat2.png');

        // Sounds
        this.load.audio('meow_sound', '/sounds/meow.wav');
    }

    create() {
        this.scene.launch('UIScene');
        
        // --- Socket.IO Connection ---
        // For local testing: 'http://localhost:3001'
        // For production: your server's public URL
        this.socket = io('http://localhost:3001');

        const map = this.make.tilemap({ key: 'map' });
        const tileset = map.addTilesetImage('spritesheet', 'tiles');
        this.groundLayer = map.createLayer('Tile Layer 1', tileset, 0, 0);

        this.otherPlayers = this.add.group(); // Group to hold other players

        // --- Socket.IO Listeners ---
        this.socket.on('currentPlayers', (players) => {

          // 1. Find the current player's data first
          const selfId = this.socket.id;
          const selfData = players[selfId];

          // 2. Create the main player object. This is now guaranteed to happen first.
          this.player = new IsometricPlayer(this, selfData.x, selfData.y, this.socket);
          this.player.setTilemap(map); 

          this.cameras.main.startFollow(this.player.sprite, true);
          this.cameras.main.setZoom(2.8);

            Object.keys(players).forEach((id) => {
                if (id !== selfId) {
                  // This is another player, so add their sprite
                  this.addOtherPlayer(players[id]);
                }
            });
        });

        this.socket.on('newPlayer', (playerInfo) => {
            this.addOtherPlayer(playerInfo);
        });

        this.socket.on('playerDisconnected', (playerId) => {
            this.otherPlayers.getChildren().forEach((otherPlayer) => {
                if (playerId === otherPlayer.playerId) {
                    otherPlayer.destroy();
                }
            });
        });

        this.socket.on('playerMoved', (playerInfo) => {
            this.otherPlayers.getChildren().forEach((otherPlayer) => {
                if (playerInfo.playerId === otherPlayer.playerId) {
                    // Use a tween for smooth movement
                    this.tweens.add({
                        targets: otherPlayer,
                        x: this.player.gridToWorldPosition(playerInfo.x, playerInfo.y, true).x,
                        y: this.player.gridToWorldPosition(playerInfo.x, playerInfo.y, true).y,
                        duration: this.player.moveSpeed * 1.6,
                        ease: 'Linear'
                    });
                    // Update sprite texture and flip
                    this.player.updateSpriteDirection.call({ sprite: otherPlayer }, playerInfo.direction);
                }
            });
        });

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        this.joystick = null;
        if (window.matchMedia("(pointer: coarse)").matches) {
            this.joystick = new Joystick(this, 1150, 590);
            this.joystick.setVisible(true);
        }
    }
    
    // Helper function to add other players
    addOtherPlayer(playerInfo) {
        // We need a reference to the main player to use its helper methods
        if (!this.player) return; 

        const worldPos = this.player.gridToWorldPosition(playerInfo.x, playerInfo.y, true);
        const otherPlayer = this.add.sprite(worldPos.x, worldPos.y, 'cat1').setScale(0.3).setOrigin(0.35, 0.75);
        
        otherPlayer.playerId = playerInfo.playerId;
        this.otherPlayers.add(otherPlayer);
    }

    update(time, delta) {
        if (this.player) {
            this.player.handleInput(this.cursors, this.wasd);
            if (this.joystick) {
                this.player.handleJoystickInput(this.joystick);
            }
        }
    }
}

// --- CONFIG (Updated) ---
// Now includes both scenes.
const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game',
    backgroundColor: '#2c3e50',
    // The GameScene will be started first, and the UIScene will be drawn on top of it.
    scene: [GameScene, UIScene],
    plugins: {
        global: [{
            key: 'rexVirtualJoystick',
            plugin: VirtualJoystickPlugin,
            start: true
        }]
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

// Start the application (unchanged)
async function startApp() {
    try {
        await setupDiscordSdk();
    } catch (error) {
        if (isDiscordActivity) {
            console.error('Discord SDK error:', error);
        }
    }
    const game = new Phaser.Game(config);
}

startApp();

export default {};