import Phaser from 'phaser';

export class InputManager {
    constructor(scene) {
        this.scene = scene;
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.wasd = this.scene.input.keyboard.addKeys('W,S,A,D');
        this.joystickCursors = null;

        // Listen for joystick updates from the UIScene
        this.scene.game.events.on('joystick-update', (cursors) => {
            this.joystickCursors = cursors;
        });
    }

    getDirection() {
        // Keyboard input
        if (this.cursors.up.isDown || this.wasd.W.isDown) {
            return 'up-left';
        }
        if (this.cursors.right.isDown || this.wasd.D.isDown) {
            return 'up-right';
        }
        if (this.cursors.down.isDown || this.wasd.S.isDown) {
            return 'down-right';
        }
        if (this.cursors.left.isDown || this.wasd.A.isDown) {
            return 'down-left';
        }

        // Joystick input
        if (this.joystickCursors) {
            const { up, down, left, right } = this.joystickCursors;
            if (up.isDown && left.isDown) {
                return 'up-left';
            }
            if (up.isDown && right.isDown) {
                return 'up-right';
            }
            if (down.isDown && right.isDown) {
                return 'down-right';
            }
            if (down.isDown && left.isDown) {
                return 'down-left';
            }
        }

        return null; // No input
    }
}