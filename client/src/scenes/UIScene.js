import Phaser from 'phaser';
import { Joystick } from '../../joystick.js';

const urlParams = new URLSearchParams(window.location.search);
const isDiscordActivity = urlParams.has('frame_id');

export class UIScene extends Phaser.Scene {
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
            this.joystickCursors = joystick.createCursorKeys();

            // Meow button
            const meowButton = this.add.circle(1240, 40, 25, 0xcccccc, 0.8).setInteractive();
            meowButton.on('pointerdown', () => {
                const gameScene = this.scene.get('LevelScene');
                if (gameScene && gameScene.socket) {
                    gameScene.socket.emit('meow');
                }
            });
        } else {
            // --- Updated Desktop 'M' Key ---
            this.input.keyboard.addKey('M').on('down', () => {
                const gameScene = this.scene.get('LevelScene');
                if (gameScene && gameScene.socket) {
                    gameScene.socket.emit('meow');
                }
            });
        }
    }

    update() {
        // --- 3. Send joystick data to the Game Scene every frame ---
        if (this.joystickCursors) {
            const gameScene = this.scene.get('LevelScene');
            if (gameScene && gameScene.player) {
                gameScene.player.handleJoystickInput(this.joystickCursors);
            }
        }
    }
}