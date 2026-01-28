import { Vector } from '../core/Vector';

export type ParticleType = 'spark' | 'ring' | 'smoke' | 'text' | 'shockwave' | 'square';

export class Particle {
  pos: Vector;
  vel: Vector;
  color: string;
  life: number;
  maxLife: number;
  size: number;
  type: ParticleType;
  targetSize: number = 0;

  constructor(
    x: number,
    y: number,
    color: string,
    speed: number,
    life: number,
    type: ParticleType = 'spark',
    customVel?: Vector
  ) {
    this.pos = new Vector(x, y);
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.type = type;
    this.size = type === 'smoke' ? 10 : (Math.random() * 3 + 2);

    if (type === 'shockwave') {
      this.targetSize = life; 
      this.life = 40; 
      this.maxLife = 40;
      this.size = 10; 
      this.vel = new Vector(0, 0); 
    }

    if (customVel) {
      this.vel = customVel;
    } else {
      const angle = Math.random() * Math.PI * 2;
      this.vel = Vector.fromAngle(angle).mult(Math.random() * speed);
    }
  }

  update() {
    this.pos = this.pos.add(this.vel);
    this.life--;

    if (this.type === 'shockwave') {
      this.size += (this.targetSize - this.size) * 0.15;
      if (this.size > this.targetSize * 0.95) this.life -= 2;
    }
    else if (this.type === 'ring') {
      this.size += 2;
      this.vel = new Vector(0, 0);
    }
    else if (this.type === 'smoke') {
      this.vel = this.vel.mult(0.95);
      this.size += 0.5;
    }
    else {
      // 'square' cai aqui (física padrão com atrito)
      this.vel = this.vel.mult(0.92);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();

    let alpha = this.life / this.maxLife;

    if (this.type === 'shockwave') {
      ctx.globalAlpha = Math.pow(alpha, 2); 
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 15 * alpha; 
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.size, 0, Math.PI * 2);
      ctx.stroke();
    }
    else if (this.type === 'ring') {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.size, 0, Math.PI * 2);
      ctx.stroke();
    } 
    // ADICIONADO: Lógica para desenhar o quadrado
    else if (this.type === 'square') {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      // fillRect(x, y, w, h) - subtraímos metade do tamanho para centralizar no ponto
      ctx.fillRect(this.pos.x - this.size/2, this.pos.y - this.size/2, this.size, this.size);
    }
    else {
      // spark/smoke
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}