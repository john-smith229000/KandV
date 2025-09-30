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
        this.currentMap = 'map';
        this.spawnPos = { x: 14, y: 8 };
    }
    // This function runs when the scene is started or restarted
    init(data) {
        if (data.map) {
            this.currentMap = data.map;
        }
        this.spawnPos = data.spawnPos || { x: 14, y: 8 };
    }

    preload() {
        // Maps
        this.load.image('tiles', '/images/tiles/isometric tileset/spritesheet.png');
        //this.load.tilemapTiledJSON('map', '/images/maps/testmap2.json');
        this.load.tilemapTiledJSON('map', '/images/maps/testmap3.json');
        this.load.tilemapTiledJSON('heartmap', '/images/maps/heartmap.json');

        // Load the new character sprites
        this.load.image('cat1', '/images/actors/cat1.png');
        this.load.image('cat2', '/images/actors/cat2.png');

        // Sounds
        this.load.audio('meow_sound', '/sounds/meow.wav');
    }

    create() {
        // Relaunch UIScene every time
        if (!this.scene.isActive('UIScene')) {
            this.scene.launch('UIScene');
        }
        
        // Store socket in game registry so it persists across scene restarts
        if (!this.game.registry.get('socket')) {
            const socketURL = window.location.protocol === 'https' ? window.location.origin : 'http://localhost:3001';
            const socket = io(socketURL);
            this.game.registry.set('socket', socket);
            this.socket = socket;
        } else {
            this.socket = this.game.registry.get('socket');
            // Clean up old listeners before setting up new ones
            this.socket.removeAllListeners();
        }

        // Create the map BEFORE setting up socket listeners
        this.map = this.make.tilemap({ key: this.currentMap });
        const tileset = this.map.addTilesetImage('spritesheet', 'tiles');
        this.map.createLayer('Ground', tileset, 0, 0);

        if (this.map.getLayer('Bridge')) {
            this.map.createLayer('Bridge', tileset, 0, 0);
        }
        if (this.map.getLayer('Foliage')) {
            this.map.createLayer('Foliage', tileset, 0, 0);
        }
        this.groundLayer = this.map.getLayer('Ground').tilemapLayer;
        this.otherPlayers = this.add.group();

        // NOW set up socket listeners
        this.setupSocketListeners();

        // Keyboard input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
    }

    setupSocketListeners() {
        // Create the player FIRST, before any socket events
        this.player = new IsometricPlayer(this, this.spawnPos.x, this.spawnPos.y, this.socket);
        this.player.setTilemap(this.map);
        this.cameras.main.startFollow(this.player.sprite, true);
        this.cameras.main.setZoom(2.8);

        // Set up trigger zones
        const triggerLayer = this.map.getObjectLayer('EllipseTrigger');
        if (triggerLayer && this.player) {
            triggerLayer.objects.forEach(obj => {
                if (obj.name === 'flowecircle' && obj.ellipse) {
                    const triggerZone = this.add.ellipse(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width, obj.height);
                    this.physics.add.existing(triggerZone, true);
                    this.physics.add.overlap(this.player.sprite, triggerZone, () => {
                        console.log('Player entered the flower circle!');
                        this.changeMap('heartmap', { x: 20, y: 20 });
                    });
                }
            });
        }

        // Now handle socket events
        this.socket.on('currentPlayers', (players) => {
            const selfId = this.socket.id;
            
            // Notify server of our position if we teleported to a different map
            if (this.currentMap !== 'map') {
                this.socket.emit('playerTeleport', this.spawnPos);
            }

            Object.keys(players).forEach((id) => {
                if (id !== selfId) {
                this.addOtherPlayer(players[id]);
                }
            });
        });

        this.socket.on('newPlayer', (playerInfo) => {
            if (playerInfo.playerId === this.socket.id) {
                return;
            }
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
                    this.tweens.add({
                        targets: otherPlayer,
                        x: this.player.gridToWorldPosition(playerInfo.x, playerInfo.y, true).x,
                        y: this.player.gridToWorldPosition(playerInfo.x, playerInfo.y, true).y,
                        duration: this.player.moveSpeed * 1.6,
                        ease: 'Linear'
                    });
                    this.player.updateSpriteDirection.call({ sprite: otherPlayer }, playerInfo.direction);
                }
            });
        });

        this.socket.on('meow', (playerId) => {
        this.sound.play('meow_sound');
        });
    }


    shutdown() {
        console.log("Scene shutting down, removing listeners...");
        // This removes all listeners from the socket, preventing duplicates
        if (this.socket) {
            this.socket.removeAllListeners();
        }
    }

    changeMap(mapKey, spawnPos) {
        // Prevent the teleport from triggering multiple times
        if (this.isTeleporting) return;
        this.isTeleporting = true;

        // Fade the camera to black
        this.cameras.main.fadeOut(500, 0, 0, 0);

        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.isTeleporting = false;
            // Stop the UIScene before restarting GameScene
            this.scene.stop('UIScene');
            // Pass the new map AND the new spawn position to the restarted scene
            this.scene.restart({ map: mapKey, spawnPos: spawnPos });
        });
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