import Phaser from 'phaser';
import { io } from 'socket.io-client';
import { IsometricPlayer } from '../../isometric.js';
import { InputManager } from '../core/InputManager.js';

const DEPTHS = {
    GROUND: 0,
    BRIDGE: 5,
    FOLIAGE: 10,
    MOVEABLE: 20,
};

export class LevelScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LevelScene' });
        this.currentMap = 'map';
        this.spawnPos = { x: 13, y: 11 };
    }

    init(data) {
        if (data.map) {
            this.currentMap = data.map;
        }
        this.spawnPos = data.spawnPos || { x: 13, y: 11 };
    }

    create() {
        if (!this.scene.isActive('UIScene')) {
            this.scene.launch('UIScene');
        }

        this.inputManager = new InputManager(this);
        
        // Store socket in game registry so it persists across scene restarts
        if (!this.game.registry.get('socket')) {
            const socketURL = window.location.protocol === 'https:' ? window.location.origin : 'http://localhost:3001';
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
        
        this.map.createLayer('Ground', tileset, 0, 0).setDepth(DEPTHS.GROUND).setCullPadding(4,4);

        if (this.map.getLayer('Moveable')) {
            this.moveableLayer = this.map.createLayer('Moveable', tileset, 0, 0).setDepth(DEPTHS.MOVEABLE).setCullPadding(4,4);
        } else {
            this.moveableLayer = null;
        }
        
        if (this.map.getLayer('Bridge')) {
            this.map.createLayer('Bridge', tileset, 0, 0).setDepth(DEPTHS.BRIDGE).setCullPadding(4,4);
        }
        
        if (this.map.getLayer('Foliage')) {
            this.map.createLayer('Foliage', tileset, 0, 0).setDepth(DEPTHS.FOLIAGE).setCullPadding(4,4);
        }
        
        this.otherPlayers = this.add.group();

        // NOW set up socket listeners (which creates the player)
        this.setupSocketListeners();
    }

    setupSocketListeners() {
        // Create the player FIRST, before any socket events
        this.player = new IsometricPlayer(this, this.spawnPos.x, this.spawnPos.y, this.socket);
        this.player.setTilemap(this.map);
        this.cameras.main.startFollow(this.player.sprite, true).setZoom(2.8);

        // Set up trigger zones
        const triggerLayer = this.map.getObjectLayer('EllipseTrigger');
        if (triggerLayer && this.player) {
            triggerLayer.objects.forEach(obj => {
                if (obj.name === 'flowecircle' && obj.ellipse) {
                    const triggerZone = this.add.ellipse(
                        obj.x + obj.width / 2, 
                        obj.y + obj.height / 2, 
                        obj.width, 
                        obj.height
                    );
                    this.physics.add.existing(triggerZone, true);
                    const radius = Math.min(obj.width, obj.height) / 2;
                    triggerZone.body.setCircle(radius);
                    
                    this.physics.add.overlap(this.player.sprite, triggerZone, () => {
                        this.changeLevel('heartmap', { x: 14, y: 22 });
                    });
                }
            });
        }

        // Notify server of our current map immediately after player is created
        this.socket.emit('playerChangedMap', {
            map: this.currentMap,
            x: this.spawnPos.x,
            y: this.spawnPos.y
        });

        // Socket event listeners
        this.socket.on('currentPlayers', (players) => {
            const selfId = this.socket.id;
            this.otherPlayers.clear(true, true);
            
            Object.keys(players).forEach((id) => {
                if (id !== selfId) {
                    this.addOtherPlayer(players[id]);
                }
            });
        });

        this.socket.on('newPlayer', (playerInfo) => {
            if (playerInfo.playerId === this.socket.id) return;
            
            const existing = this.otherPlayers.getChildren().find(p => p.playerId === playerInfo.playerId);
            if (!existing) {
                this.addOtherPlayer(playerInfo);
            }
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
                    this.tweens.killTweensOf(otherPlayer);
                    
                    this.tweens.add({
                        targets: otherPlayer,
                        x: this.player.gridToWorldPosition(playerInfo.x, playerInfo.y, true).x,
                        y: this.player.gridToWorldPosition(playerInfo.x, playerInfo.y, true).y,
                        duration: this.player.defaultMoveSpeed * 1.6,
                        ease: 'Linear',
                        onUpdate: () => {
                            otherPlayer.setDepth(otherPlayer.y);
                        }
                    });
                    this.player.updateSpriteDirection.call({ sprite: otherPlayer }, playerInfo.direction);
                }
            });
        });

        this.socket.on('moveableTileUpdated', (data) => {
            if (this.player && this.moveableLayer) {
                this.player.animateTilePush(data);
            }
        });

        this.socket.on('meow', (playerId) => {
            this.sound.play('meow_sound');
        });
    }

    shutdown() {
        if (this.socket) {
            this.socket.removeAllListeners();
        }
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
        if (!this.player) return;
        
        const existingPlayer = this.otherPlayers.getChildren().find(p => p.playerId === playerInfo.playerId);
        if (existingPlayer) return;

        const worldPos = this.player.gridToWorldPosition(playerInfo.x, playerInfo.y, true);
        const otherPlayer = this.add.sprite(worldPos.x, worldPos.y, 'cat1')
            .setScale(0.3)
            .setOrigin(0.35, 0.75);
        
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