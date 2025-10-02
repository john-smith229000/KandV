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

        // --- "New Game" button is now a placeholder ---
        const newGameButton = this.add.text(width / 2, height / 2, 'New Game', { 
            fontSize: '32px', 
            fill: '#00ff00' 
        }).setOrigin(0.5).setAlpha(0.5); // Set to be semi-transparent

        // We can add a pointerdown event later when it's ready
        // newGameButton.setInteractive().on('pointerdown', () => { ... });


        // Tutorial button
        const tutorialButton = this.add.text(width / 2, height / 2 + 50, 'Tutorial', {
            fontSize: '32px',
            fill: '#00ffff'
        }).setOrigin(0.5).setInteractive();

        tutorialButton.on('pointerdown', () => {
            this.scene.start('LevelScene', { map: 'map', spawnPos: { x: 13, y: 11 } });
        });

        // Continue button
        const continueButton = this.add.text(width / 2, height / 2 + 100, 'Continue', { 
            fontSize: '32px', 
            fill: '#ffff00' 
        }).setOrigin(0.5).setInteractive();

        continueButton.on('pointerdown', () => {
            this.scene.start('LevelScene', { map: 'map', spawnPos: { x: 13, y: 11 } });
        });
    }
}