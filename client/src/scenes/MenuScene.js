import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const { width, height } = this.cameras.main;

        // Title
        this.add.text(width / 2, height / 2 - 100, 'Nine Lives', { 
            fontSize: '64px', 
            fill: '#ffffff' 
        }).setOrigin(0.5);

        // New Game button
        const newGameButton = this.add.text(width / 2, height / 2, 'New Game', { 
            fontSize: '32px', 
            fill: '#00ff00' 
        }).setOrigin(0.5).setInteractive();

        newGameButton.on('pointerdown', () => {
            // This can be a different map later
            this.scene.start('LevelScene', { map: 'map', spawnPos: { x: 13, y: 11 } });
        });

        // Tutorial button - NOW loads 'map' (frmt.json)
        const tutorialButton = this.add.text(width / 2, height / 2 + 50, 'Tutorial', {
            fontSize: '32px',
            fill: '#00ffff'
        }).setOrigin(0.5).setInteractive();

        tutorialButton.on('pointerdown', () => {
            // Start the level using the 'map' key, which loads frmt.json
            this.scene.start('LevelScene', { map: 'map', spawnPos: { x: 13, y: 11 } });
        });

        // Continue button
        const continueButton = this.add.text(width / 2, height / 2 + 100, 'Continue', { 
            fontSize: '32px', 
            fill: '#ffff00' 
        }).setOrigin(0.5).setInteractive();

        continueButton.on('pointerdown', () => {
            // This will later load from GameState
            this.scene.start('LevelScene', { map: 'map', spawnPos: { x: 13, y: 11 } });
        });
    }
}