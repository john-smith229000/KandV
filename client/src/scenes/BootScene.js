import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // A simple loading bar
        const { width, height } = this.cameras.main;
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: 'Loading...',
            style: {
                font: '20px monospace',
                fill: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5, 0.5);

        const percentText = this.make.text({
            x: width / 2,
            y: height / 2,
            text: '0%',
            style: {
                font: '18px monospace',
                fill: '#ffffff'
            }
        });
        percentText.setOrigin(0.5, 0.5);

        this.load.on('progress', (value) => {
            percentText.setText(parseInt(value * 100) + '%');
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();
        });

        // Load all your assets here
        const timestamp = new Date().getTime();
        this.load.image('tiles', `/images/tiles/isometric tileset/spritesheet.png?v=${timestamp}`);
        this.load.tilemapTiledJSON('map', '/images/maps/frmt.json');
        this.load.tilemapTiledJSON('heartmap', '/images/maps/heartmap.json');
        this.load.tilemapTiledJSON('tutorialmap', '/images/maps/testmap.json'); 

        this.load.image('cat1', '/images/actors/cat1.png');
        this.load.image('cat2', '/images/actors/cat2.png');

        this.load.audio('meow_sound', '/sounds/meow.wav');
        this.load.audio('water_sound', '/sounds/water.wav');
    }

    create() {
        // Start the Menu Scene
        this.scene.start('MenuScene');
    }
}