export class Vector {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  add(v: Vector): Vector {
    return new Vector(this.x + v.x, this.y + v.y);
  }

  sub(v: Vector): Vector {
    return new Vector(this.x - v.x, this.y - v.y);
  }

  mult(n: number): Vector {
    return new Vector(this.x * n, this.y * n);
  }

  div(n: number): Vector {
    return new Vector(this.x / n, this.y / n);
  }

  mag(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  norm() {
    const m = this.mag();
    if (m < 0.0001) return new Vector(0, 0);

    return this.div(m);
  }

  dist(v: Vector): number {
    return Math.sqrt(Math.pow(this.x - v.x, 2) + Math.pow(this.y - v.y, 2));
  }

  limit(max: number): Vector {
    if (this.mag() > max) {
      return this.norm().mult(max);
    }
    return this;
  }

  copy(): Vector {
    return new Vector(this.x, this.y);
  }

  static fromAngle(angle: number): Vector {
    return new Vector(Math.cos(angle), Math.sin(angle));
  }
}