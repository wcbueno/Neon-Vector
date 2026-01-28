import { Vector } from '../core/Vector';
import { Enemy } from './Enemy';
import { IBoss } from './Boss';
import { Particle } from './Particle';

import { COLORS } from '../utils/Constants'; 

export class AreaEffect {
  pos: Vector;
  type: 'black_hole';
  life: number;
  radius: number;
  
  constructor(x: number, y: number, type: 'black_hole') {
    this.pos = new Vector(x, y);
    this.type = type;
    this.life = 300; // 5 seconds
    this.radius = 300;
  }

  update(enemies: Enemy[], bosses: IBoss[], particles: Particle[]) {
    this.life--;
    
    if (this.type === 'black_hole') {
      // Visuals
      if (this.life % 5 === 0) {
         // Agora 'square' é válido!
         particles.push(new Particle(this.pos.x + (Math.random()-0.5)*50, this.pos.y + (Math.random()-0.5)*50, '#000', 1, 4, 'square'));
      }
      
      // Pull and Damage Enemies
      for (const e of enemies) {
        const dist = e.pos.dist(this.pos);
        if (dist < this.radius) {
          const pull = this.pos.sub(e.pos).norm().mult(2.5);
          e.pos = e.pos.add(pull);
          e.hp -= 2.0; 
        }
      }

      // Pull and Damage Bosses (Resistant)
      for (const b of bosses) {
        const dist = b.pos.dist(this.pos);
        if (dist < this.radius) {
          const pull = this.pos.sub(b.pos).norm().mult(0.5); 
          b.pos = b.pos.add(pull);
          b.hp -= 2.0; 
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.type === 'black_hole') {
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      
      // Horizon
      ctx.beginPath();
      ctx.fillStyle = '#000000';
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.fill();
      
      // Accretion Disk
      ctx.rotate(Date.now() / 200);
      ctx.beginPath();
      ctx.strokeStyle = '#4b0082';
      ctx.lineWidth = 4;
      ctx.arc(0, 0, 60 + Math.sin(Date.now()/100)*10, 0, Math.PI*2);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = '#8000ff';
      ctx.lineWidth = 2;
      ctx.arc(0, 0, 90, Math.PI, Math.PI*2.5);
      ctx.stroke();

      ctx.restore();
    }
  }
}