import './style.css';
import Phaser from 'phaser';
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
    }
}


// --- GAME SCENE (Updated) ---
// Now focused only on the game world, with all text code removed.
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        this.load.image('tiles', '/images/tiles/isometric tileset/spritesheet.png');
        this.load.tilemapTiledJSON('map', '/images/maps/testmap2.json');

        // Load the new character sprites
        this.load.image('cat1', '/images/actors/cat1.png');
        this.load.image('cat2', '/images/actors/cat2.png');
    }

    create() {
        // Launch the UI Scene to run in parallel
        this.scene.launch('UIScene');

        const map = this.make.tilemap({ key: 'map' });
        const tileset = map.addTilesetImage('spritesheet', 'tiles');
        const groundLayer = map.createLayer('Tile Layer 1', tileset, 0, 0);

        // --- Only add Fullscreen option when NOT in Discord ---
        if (!isDiscordActivity) {
            const FKey = this.input.keyboard.addKey('F');

            FKey.on('down', () => {
                if (this.scale.isFullscreen) {
                    this.scale.stopFullscreen();
                } else {
                    this.scale.startFullscreen();
                }
            });
        }

        this.player = new IsometricPlayer(this, 15, 18);
        this.player.setTilemap(map);

        this.cameras.main.startFollow(this.player.sprite, true);
        this.cameras.main.setZoom(2.7);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');

        this.joystick = null;
        if (window.matchMedia("(pointer: coarse)").matches) {
            this.joystick = new Joystick(this, 1150, 590);
            this.joystick.setVisible(true);
        }
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