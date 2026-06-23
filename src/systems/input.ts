import Phaser from 'phaser';

export interface GameKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  arrowUp: Phaser.Input.Keyboard.Key;
  arrowDown: Phaser.Input.Keyboard.Key;
  arrowLeft: Phaser.Input.Keyboard.Key;
  arrowRight: Phaser.Input.Keyboard.Key;
  strike: Phaser.Input.Keyboard.Key;
  cast: Phaser.Input.Keyboard.Key;
  terminal: Phaser.Input.Keyboard.Key;
  pause: Phaser.Input.Keyboard.Key;
  tokenOne: Phaser.Input.Keyboard.Key;
  tokenTwo: Phaser.Input.Keyboard.Key;
  tokenThree: Phaser.Input.Keyboard.Key;
  tokenFour: Phaser.Input.Keyboard.Key;
  interact: Phaser.Input.Keyboard.Key;
  abilityKey: Phaser.Input.Keyboard.Key;
}

export function createGameKeys(scene: Phaser.Scene): GameKeys {
  const keyboard = scene.input.keyboard;
  if (!keyboard) {
    throw new Error('Keyboard input is unavailable.');
  }
  return keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    right: Phaser.Input.Keyboard.KeyCodes.D,
    arrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
    arrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
    arrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
    arrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    strike: Phaser.Input.Keyboard.KeyCodes.X,
    cast: Phaser.Input.Keyboard.KeyCodes.SPACE,
    terminal: Phaser.Input.Keyboard.KeyCodes.T,
    pause: Phaser.Input.Keyboard.KeyCodes.ESC,
    tokenOne: Phaser.Input.Keyboard.KeyCodes.ONE,
    tokenTwo: Phaser.Input.Keyboard.KeyCodes.TWO,
    tokenThree: Phaser.Input.Keyboard.KeyCodes.THREE,
    tokenFour: Phaser.Input.Keyboard.KeyCodes.FOUR,
    interact: Phaser.Input.Keyboard.KeyCodes.ENTER,
    abilityKey: Phaser.Input.Keyboard.KeyCodes.Z,
  }) as GameKeys;
}
