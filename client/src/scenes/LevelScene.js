import Phaser from 'phaser';
import { io } from 'socket.io-client';
import { IsometricPlayer } from '../../isometric.js';
import { InputManager } from '../core/InputManager.js';
import GameState from '../core/GameState.js';

const DEPTHS = {
    GROUND: 0,
    BRIDGE: 5,
    FOLIAGE: 10,
    MOVEABLE: 20,
};

export class LevelScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LevelScene' });
        // ... (same as before)
    }

    init(data) {
        this.currentMap = data.map || 'map';
        this.spawnPos = data.spawnPos || { x: 13, y: 11 };
    }

    create() {
        if (!this.scene.isActive('UIScene')) {
            this.scene.launch('UIScene');
        }

        this.inputManager = new InputManager(this);
        
        // Socket setup
        if (this.game.registry.get('socket')) {
            this.socket = this.game.registry.get('socket');
        } else {
            const socketURL = window.location.protocol === 'https' ? window.location.origin : 'http://localhost:3001';
            this.socket = io(socketURL);
            this.game.registry.set('socket', this.socket);
        }
        
        // This is crucial for scene restarts. It clears old listeners before setting new ones.
        this.shutdown();
        this.setupSocketListeners();

        // --- World Initialization ---
        this.map = this.make.tilemap({ key: this.currentMap });
        const tileset = this.map.addTilesetImage('spritesheet', 'tiles');
        
        this.map.createLayer('Ground', tileset, 0, 0).setDepth(DEPTHS.GROUND);
        
        // 🔽 THE FIX IS HERE 🔽
        // Explicitly set layers to null if they don't exist on the new map.
        this.moveableLayer = this.map.getLayer('Moveable') ? this.map.createLayer('Moveable', tileset, 0, 0).setDepth(DEPTHS.MOVEABLE) : null;
        this.bridgeLayer = this.map.getLayer('Bridge') ? this.map.createLayer('Bridge', tileset, 0, 0).setDepth(DEPTHS.BRIDGE) : null;
        this.foliageLayer = this.map.getLayer('Foliage') ? this.map.createLayer('Foliage', tileset, 0, 0).setDepth(DEPTHS.FOLIAGE) : null;
        
        this.otherPlayers = this.add.group();

        // Player setup
        this.player = new IsometricPlayer(this, this.spawnPos.x, this.spawnPos.y, this.socket);
        this.player.setTilemap(this.map);
        this.cameras.main.startFollow(this.player.sprite, true).setZoom(2.8);

        // Set up trigger zones
        const triggerLayer = this.map.getObjectLayer('EllipseTrigger');
        if (triggerLayer) {
            triggerLayer.objects.forEach(obj => {
                if (obj.name === 'flowecircle' && obj.ellipse) {
                    const triggerZone = this.add.ellipse(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width, obj.height);
                    this.physics.add.existing(triggerZone, true);
                    const radius = Math.min(obj.width, obj.height) / 2;
                    triggerZone.body.setCircle(radius);
                    
                    this.physics.add.overlap(this.player.sprite, triggerZone, () => {
                        this.changeLevel('heartmap', { x: 14, y: 22 });
                    });
                }
            });
        }
        
        // Notify the server
        this.socket.emit('playerChangedMap', {
            map: this.currentMap,
            x: this.spawnPos.x,
            y: this.spawnPos.y
        });
    }

    shutdown() {
        // This is called automatically by Phaser when the scene shuts down
        // It correctly removes only our game-specific listeners
        this.socket.off('currentPlayers');
        this.socket.off('newPlayer');
        this.socket.off('playerDisconnected');
        this.socket.off('playerMoved');
        this.socket.off('meow');
        this.socket.off('moveableTilesState');
        this.socket.off('moveableTileUpdated');
    }

    initializeWorld() {
        this.map = this.make.tilemap({ key: this.currentMap });
        const tileset = this.map.addTilesetImage('spritesheet', 'tiles');
        
        this.map.createLayer('Ground', tileset, 0, 0).setDepth(DEPTHS.GROUND);
        if (this.map.getLayer('Moveable')) {
            this.moveableLayer = this.map.createLayer('Moveable', tileset, 0, 0).setDepth(DEPTHS.MOVEABLE);
        }
        if (this.map.getLayer('Bridge')) {
            this.map.createLayer('Bridge', tileset, 0, 0).setDepth(DEPTHS.BRIDGE);
        }
        if (this.map.getLayer('Foliage')) {
            this.map.createLayer('Foliage', tileset, 0, 0).setDepth(DEPTHS.FOLIAGE);
        }
        this.otherPlayers = this.add.group();

        this.player = new IsometricPlayer(this, this.spawnPos.x, this.spawnPos.y, this.socket);
        this.player.setTilemap(this.map);
        this.cameras.main.startFollow(this.player.sprite, true).setZoom(2.8);

        const triggerLayer = this.map.getObjectLayer('EllipseTrigger');
        if (triggerLayer) {
            triggerLayer.objects.forEach(obj => {
                if (obj.name === 'flowecircle' && obj.ellipse) {
                    const triggerZone = this.add.ellipse(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width, obj.height);
                    this.physics.add.existing(triggerZone, true);
                    triggerZone.body.setCircle(Math.min(obj.width, obj.height) / 2);
                    this.physics.add.overlap(this.player.sprite, triggerZone, () => {
                        this.changeLevel('heartmap', { x: 14, y: 22 });
                    });
                }
            });
        }
    }

    setupSocketListeners() {
        // This is where we ADD our listeners
        this.socket.on('currentPlayers', (players) => {
            Object.keys(players).forEach((id) => {
                if (id !== this.socket.id) this.addOtherPlayer(players[id]);
            });
        });
        this.socket.on('newPlayer', (playerInfo) => {
            if (playerInfo.playerId !== this.socket.id) this.addOtherPlayer(playerInfo);
        });
        this.socket.on('playerDisconnected', (playerId) => {
            this.otherPlayers.getChildren().forEach((p) => { if (playerId === p.playerId) p.destroy(); });
        });
        
        // Add other listeners from server/main.js refactor here
        // For example:
        this.socket.on('playerMoved', (playerInfo) => {
            this.otherPlayers.getChildren().forEach((otherPlayer) => {
                if (playerInfo.playerId === otherPlayer.playerId) {
                    this.tweens.add({ /* ... tween config ... */ });
                    this.player.updateSpriteDirection.call({ sprite: otherPlayer }, playerInfo.direction);
                }
            });
        });
        this.socket.on('meow', () => this.sound.play('meow_sound'));
    }

    changeLevel(mapKey, spawnPos) {
        if (this.isTeleporting) return;
        this.isTeleporting = true;
        
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            this.isTeleporting = false;
            this.scene.stop('UIScene');
            this.scene.restart({ map: mapKey, spawnPos: spawnPos });
        });
    }
    
    addOtherPlayer(playerInfo) {
        // This function remains the same
        if (!this.player || !playerInfo) return;
        const existingPlayer = this.otherPlayers.getChildren().find(p => p.playerId === playerInfo.playerId);
        if (existingPlayer) return;
        const worldPos = this.player.gridToWorldPosition(playerInfo.x, playerInfo.y, true);
        const otherPlayer = this.add.sprite(worldPos.x, worldPos.y, 'cat1').setScale(0.3).setOrigin(0.35, 0.75);
        otherPlayer.setDepth(worldPos.y);
        otherPlayer.playerId = playerInfo.playerId;
        this.otherPlayers.add(otherPlayer);
    }

    update() {
        if (this.player && !this.player.isMoving) {
            const direction = this.inputManager.getDirection();
            if (direction) {
                this.player.move(direction);
            }
        }
    }
}