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

        // --- Sound and Input Logic ---
        if (isMobile) {
            // --- 1. Create the Joystick in the UI Scene ---
            const { width, height } = this.cameras.main;
            const joystick = new Joystick(this, width - 100, height - 100);
            joystick.setVisible(true);

            // --- 2. Listen for joystick updates in the UI ---
            this.joystickCursors = joystick.cursorKeys;

            // Meow button logic is unchanged
            const meowButton = this.add.circle(1240, 40, 25, 0xcccccc, 0.8).setInteractive();
            // Send a 'meow' event to the server when pressed
            meowButton.on('pointerdown', () => {
                const gameScene = this.scene.get('GameScene');
                if (gameScene && gameScene.socket) {
                gameScene.socket.emit('meow');
                }
            });
            } else {
            // --- Updated Desktop 'M' Key ---
            // Send a 'meow' event to the server when 'M' is pressed
            this.input.keyboard.addKey('M').on('down', () => {
                const gameScene = this.scene.get('GameScene');
                if (gameScene && gameScene.socket) {
                gameScene.socket.emit('meow');
                }
            });
    }
    }

    update() {
        // --- 3. Send joystick data to the Game Scene every frame ---
        if (this.joystickCursors) {
            // Use the global event bus to send the data
            this.game.events.emit('joystick-update', this.joystickCursors);
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
        //this.load.tilemapTiledJSON('map', '/images/maps/testmap2.json');
        this.load.tilemapTiledJSON('map', '/images/maps/testmap3.json');

        // Load the new character sprites
        this.load.image('cat1', '/images/actors/cat1.png');
        this.load.image('cat2', '/images/actors/cat2.png');

        // Sounds
        this.load.audio('meow_sound', '/sounds/meow.wav');
    }

    create() {
        this.scene.launch('UIScene');
        
        // --- Socket.IO Connection ---
        const socketURL = window.location.protocol === 'https:' ? window.location.origin : 'http://localhost:3001';
        this.socket = io(socketURL);

        const map = this.make.tilemap({ key: 'map' });
        const tileset = map.addTilesetImage('spritesheet', 'tiles');
        //this.groundLayer = map.createLayer('Tile Layer 1', tileset, 0, 0);

        // --- 2. Create each tile layer ---
        // The order matters; layers created later will be drawn on top.
        map.createLayer('Ground', tileset, 0, 0);
        map.createLayer('Bridge', tileset, 0, 0);
        map.createLayer('Foliage', tileset, 0, 0);

        // Keep a reference to the ground layer for collision checks
        this.groundLayer = map.getLayer('Ground').tilemapLayer;

        this.otherPlayers = this.add.group(); // Group to hold other players

        // --- Socket.IO Listeners ---
        this.socket.on('currentPlayers', (players) => {
            const selfId = this.socket.id;
            const selfData = players[selfId];

            // --- PLAYER AND CAMERA LOGIC MOVED HERE ---
            if (selfData) {
                this.player = new IsometricPlayer(this, selfData.x, selfData.y, this.socket);
                this.player.setTilemap(map);

                // Now that the player exists, set up the camera
                this.cameras.main.startFollow(this.player.sprite, true);
                this.cameras.main.setZoom(2.8);
            }
            // --- END OF MOVED LOGIC ---

            Object.keys(players).forEach((id) => {
                if (id !== selfId) {
                    this.addOtherPlayer(players[id]);
                }
            });

            // --- Process the Object Layer AFTER player is created ---
            const triggerLayer = map.getObjectLayer('EllipseTrigger');
            if (triggerLayer && this.player) {
                triggerLayer.objects.forEach(obj => {
                    if (obj.name === 'flowecircle' && obj.ellipse) {
                        const triggerZone = this.add.ellipse(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width, obj.height);
                        this.physics.add.existing(triggerZone, true);
                        this.physics.add.overlap(this.player.sprite, triggerZone, () => {
                            console.log('Player entered the flower circle!');
                        });
                    }
                });
            }
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

        // --- Listen for the event from the UI Scene ---

        // Listen for the 'meow' event broadcasted from the server
        this.socket.on('meow', (playerId) => {
            // You can optionally use the playerId to do something,
            // like show who meowed. For now, we'll just play the sound.
            this.sound.play('meow_sound');
        });

        this.game.events.on('joystick-update', (cursors) => {
            // If the player exists, pass the joystick data to it
            if (this.player) {
                this.player.handleJoystickInput(cursors);
            }
        });

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
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
        // The main update loop is now simpler
        if (this.player) {
            this.player.handleInput(this.cursors, this.wasd);
            // We no longer call the joystick handler here
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
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }, // We don't need gravity for a top-down game
            debug: false // Set to true to see physics bodies
        }
    },
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