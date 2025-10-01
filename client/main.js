import './style.css';
import Phaser from 'phaser';
import { DiscordSDK } from '@discord/embedded-app-sdk';
import VirtualJoystickPlugin from 'phaser3-rex-plugins/dist/rexvirtualjoystickplugin.min.js';

// Import the new scenes
import { BootScene } from './src/scenes/BootScene.js';
import { MenuScene } from './src/scenes/MenuScene.js';
import { LevelScene } from './src/scenes/LevelScene.js';
import { UIScene } from './src/scenes/UIScene.js';

const urlParams = new URLSearchParams(window.location.search);
const isDiscordActivity = urlParams.has('frame_id');
let discordSdk = null;

async function setupDiscordSdk(game) {
    if (!isDiscordActivity) return;

    discordSdk = new DiscordSDK(urlParams.get('instance_id'));
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

    const auth = await discordSdk.commands.authenticate({
        access_token,
    });

    if (auth == null) {
        throw new Error('Authenticate command failed');
    }

    // Store the session and user IDs in the game registry
    game.registry.set('sessionID', discordSdk.instanceId);
    game.registry.set('userID', auth.user.id);
}

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game',
    backgroundColor: '#2c3e50',
    scene: [BootScene, MenuScene, LevelScene, UIScene],
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
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

async function startApp() {
    const game = new Phaser.Game(config);

    try {
        await setupDiscordSdk(game);
    } catch (error) {
        if (isDiscordActivity) {
            console.error('Discord SDK error:', error);
        }
    }
}

startApp();

export default {};