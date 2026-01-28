import { Vector } from '../core/Vector';

export class FloatingText {
  pos: Vector;
  vel: Vector; // Adicionamos Velocidade
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  opacity: number = 1;

  constructor(x: number, y: number, text: string, color: string, size: number) {
    this.pos = new Vector(x, y);
    this.text = text;
    this.color = color;
    this.size = size;
    this.life = 60; // 1 segundo de vida
    this.maxLife = 60;

    // FÍSICA DE "PULO" (ARCADE)
    // Joga o número para cima e para os lados aleatoriamente
    const vx = (Math.random() - 0.5) * 4; // Espalha horizontalmente
    const vy = -3 - Math.random() * 3;    // Joga para cima com força variada
    this.vel = new Vector(vx, vy);
  }

  update() {
    // Aplica Gravidade
    this.vel.y += 0.2;

    // Aplica Velocidade
    this.pos = this.pos.add(this.vel);

    // Atrito no ar (para não deslizar para sempre horizontalmente)
    this.vel.x *= 0.95;

    this.life--;

    // Fade out nos últimos 20 frames
    if (this.life < 20) {
      this.opacity = this.life / 20;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.font = `bold ${Math.round(this.size)}px monospace`;
    ctx.fillStyle = this.color;

    // Sombra para leitura melhor no caos
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillText(this.text, this.pos.x, this.pos.y);
    ctx.restore();
  }
}