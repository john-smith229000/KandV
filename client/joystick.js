import Phaser from 'phaser';
// Note: We don't need to import the plugin here anymore, as it's handled globally in main.js

export class Joystick {
  constructor(scene, x, y, radius = 50) {
    this.scene = scene;

    // The plugin is added to the scene in the game config, so we can use it like this:
    this.joyStick = scene.plugins.get('rexVirtualJoystick').add(scene, {
      x: x,
      y: y,
      radius: radius,
      base: scene.add.circle(0, 0, radius, 0x888888),
      thumb: scene.add.circle(0, 0, radius / 2, 0xcccccc),
      dir: '8dir', // 8 directions for diagonal movement
      forceMin: 16,
      enable: true
    });

    // Create a cursor object to read joystick states
    this.cursorKeys = this.joyStick.createCursorKeys();
  }

  // Helper method to check directions
  isDirectionDown(direction) {
    return this.cursorKeys[direction].isDown;
  }
}