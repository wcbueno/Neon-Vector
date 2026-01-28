
import { Vector } from './Vector';

export class Input {
  keys: { [key: string]: boolean };
  mouse: Vector;
  mouseDown: boolean;
  spacePressed: boolean;
  shiftPressed: boolean;

  constructor() {
    this.keys = {};
    this.mouse = new Vector(0, 0);
    this.mouseDown = false;
    this.spacePressed = false;
    this.shiftPressed = false;

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') this.spacePressed = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shiftPressed = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'Space') this.spacePressed = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shiftPressed = false;
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mousedown', () => {
      this.mouseDown = true;
    });

    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });

    window.addEventListener('blur', () => {
      this.reset();
    });
  }

  reset() {
    this.keys = {};
    this.mouseDown = false;
    this.spacePressed = false;
    this.shiftPressed = false;
  }

  getMovementVector(): Vector {
    // Keyboard only
    let x = 0;
    let y = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
    
    return new Vector(x, y).norm();
  }
}
