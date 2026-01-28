import { Vector } from '../core/Vector';
import { Player } from './Player';
import { COLORS } from '../utils/Constants';

export class Orb {
  pos: Vector;
  vel: Vector;
  value: number;
  type: 'xp' | 'health';
  radius: number;
  life: number;

  // Novo: Para o efeito visual de rastro
  trail: Vector[] = [];

  constructor(x: number, y: number, value: number, type: 'xp' | 'health' = 'xp') {
    this.pos = new Vector(x, y);

    // EFEITO POP: O orbe "pula" quando nasce
    // Joga um pouco para os lados e para cima
    this.vel = new Vector((Math.random() - 0.5) * 4, -Math.random() * 4 - 2);

    this.value = value;
    this.type = type;
    this.radius = type === 'xp' ? 5 : 8;
    this.life = 3600;
  }

  update(player: Player): boolean {
    this.life--;
    if (this.life <= 0) return false;

    // Atualiza o rastro
    this.trail.push(this.pos.copy());
    if (this.trail.length > 5) this.trail.shift();

    const dist = this.pos.dist(player.pos);
    const magnetRadius = 350 + player.magnetRadius;

    if (dist < magnetRadius) {
      const desiredDir = player.pos.sub(this.pos).norm();

      // Força do puxão
      const pullStrength = 0.8 + (1 - (dist / magnetRadius)) * 3.0;

      this.vel = this.vel.add(desiredDir.mult(pullStrength));

      // --- CORREÇÃO ANTI-ÓRBITA ---

      // 1. Fricção Magnética:
      // Isso impede que ele ganhe velocidade infinita e ajuda a fazer curvas fechadas
      this.vel = this.vel.mult(0.92);

      // 2. Trava de Mira (Hard Lock):
      // Se estiver muito perto (menos de 80px), forçamos ele a ir DIRETO para o player
      // ignorando a inércia lateral antiga. Isso elimina o círculo.
      if (dist < 80) {
        const speed = this.vel.mag(); // Mantém a velocidade atual
        this.vel = desiredDir.mult(speed); // Mas força a direção exata
      }

      // Limite de velocidade (aumentei um pouco para garantir que ele te alcance se você estiver correndo)
      this.vel = this.vel.limit(24);
    } else {
      // Atrito quando longe (freia o pop inicial)
      this.vel = this.vel.mult(0.92);
    }

    this.pos = this.pos.add(this.vel);
    return true;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();

    // 1. DESENHAR O RASTRO (TRAIL)
    // FIX: Adicionei a verificação "this.trail.length > 1" para evitar erro no spawn
    if (this.vel.mag() > 2 && this.trail.length > 1) {
      ctx.beginPath();
      // Começa do ponto mais antigo
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.lineTo(this.pos.x, this.pos.y);

      ctx.strokeStyle = this.type === 'xp' ? COLORS.ORB_XP : COLORS.ORB_HEALTH;
      ctx.lineWidth = this.radius;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.3;
      ctx.stroke();
    }

    ctx.translate(this.pos.x, this.pos.y);

    // 2. BRILHO EXTERNO
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.type === 'xp' ? COLORS.ORB_XP : '#00ff00';

    // 3. CORPO DO ORBE
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.type === 'xp' ? COLORS.ORB_XP : COLORS.ORB_HEALTH;
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.closePath();

    // 4. BRILHO INTERNO (Highlight)
    ctx.beginPath();
    ctx.arc(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();

    ctx.restore();
  }
}