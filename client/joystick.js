// client/joystick.js

import Phaser from 'phaser';

export class Joystick {
  constructor(scene, x, y, radius = 50) {
    this.scene = scene;
    
    // Create the joystick but keep it invisible initially
    this.joyStick = scene.plugins.get('rexVirtualJoystick').add(scene, {
      x: x,
      y: y,
      radius: radius,
      base: scene.add.circle(0, 0, radius, 0x888888, 0.5),
      thumb: scene.add.circle(0, 0, radius / 2, 0xcccccc, 0.8),
      dir: '8dir',
      forceMin: 16,
      enable: true
    });

    this.cursorKeys = this.joyStick.createCursorKeys();
    
    // Hide it by default
    this.setVisible(false);
  }

  // Method to control visibility
  setVisible(visible) {
    this.joyStick.base.setVisible(visible);
    this.joyStick.thumb.setVisible(visible);
  }

  isDirectionDown(direction) {
    return this.cursorKeys[direction].isDown;
  }
}