
import { Vector } from '../core/Vector';
import { Enemy } from './Enemy';
import { IBoss } from './Boss';
import { Particle } from './Particle';
import { COLORS } from '../utils/Constants';
import { soundManager } from '../core/SoundManager';
import { Bullet } from './Bullet';

export class AZBoxThunder {
  pos: Vector;
  targetPos: Vector;
  state: 'arriving' | 'active' | 'departing';
  timer: number;
  finished: boolean = false;
  rotation: number = 0;
  
  // Combat stats
  damage: number = 50;
  range: number = 600;
  lightningTimer: number = 0;

  constructor(playerPos: Vector) {
    this.targetPos = playerPos.copy(); // Initial spot
    this.pos = playerPos.copy().sub(new Vector(0, 1000)); // Start high up
    this.state = 'arriving';
    this.timer = 0;
    soundManager.playPowerUp(); // Arrival sound placeholder
  }

  update(enemies: Enemy[], bosses: IBoss[], bullets: Bullet[], particles: Particle[]) {
    this.timer++;
    this.rotation += 0.1;

    if (this.state === 'arriving') {
      // Drop down animation
      const diff = this.targetPos.sub(this.pos);
      this.pos = this.pos.add(diff.mult(0.1));
      
      if (diff.mag() < 10) {
        this.state = 'active';
        this.timer = 0;
        // Impact effect
        for(let i=0; i<20; i++) {
           particles.push(new Particle(this.pos.x, this.pos.y, '#ffff00', 10, 5, 'spark'));
        }
      }
    } else if (this.state === 'active') {
       // Hover
       this.pos.y += Math.sin(this.timer * 0.1) * 2;
       
       // Attack Logic
       this.lightningTimer++;
       if (this.lightningTimer % 5 === 0) {
          // Find targets
          const targets = [...enemies, ...bosses].filter(e => e.pos.dist(this.pos) < this.range);
          
          // Chain lightning up to 3 targets
          for (let i=0; i < 3; i++) {
             if (targets.length === 0) break;
             const idx = Math.floor(Math.random() * targets.length);
             const target = targets[idx];
             
             // Deal damage
             target.hp -= this.damage;
             
             // Visual Lightning
             // Remove from pool to avoid double hitting same frame (optional)
             targets.splice(idx, 1);
          }
          if (Math.random() < 0.3) soundManager.playDash(); // Zap sound
       }

       // Duration
       if (this.timer > 900) { // 15 seconds
         this.state = 'departing';
         this.timer = 0;
       }
    } else if (this.state === 'departing') {
       this.pos.y -= 20; // Fly up
       if (this.timer > 60) this.finished = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D, enemies: Enemy[], bosses: IBoss[]) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    
    // Draw "AZBoxThunder" - A badass box
    ctx.rotate(this.rotation);
    ctx.fillStyle = '#ffaa00'; // Gold/Yellow
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 20;
    
    const size = 40;
    ctx.fillRect(-size/2, -size/2, size, size);
    
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(-size/4, -size/4, size/2, size/2);
    
    // Orbiting bits
    ctx.rotate(-this.rotation * 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-size, -size/4, 10, 10);
    ctx.fillRect(size-10, -size/4, 10, 10);
    ctx.fillRect(-5, -size, 10, 10);
    ctx.fillRect(-5, size-10, 10, 10);

    ctx.restore();

    // Draw Lightning in Active State
    if (this.state === 'active' && this.lightningTimer % 5 === 0) {
       const targets = [...enemies, ...bosses].filter(e => e.pos.dist(this.pos) < this.range);
       
       // Re-find some targets just for visuals (simple logic)
       ctx.beginPath();
       ctx.strokeStyle = '#00ffff';
       ctx.lineWidth = 3;
       ctx.shadowColor = '#fff';
       ctx.shadowBlur = 10;
       
       for (let i=0; i<3; i++) {
          if (targets.length === 0) break;
          const t = targets[Math.floor(Math.random() * targets.length)];
          
          ctx.moveTo(this.pos.x, this.pos.y);
          // Zigzag
          const mid = this.pos.add(t.pos.sub(this.pos).mult(0.5)).add(new Vector((Math.random()-0.5)*50, (Math.random()-0.5)*50));
          ctx.lineTo(mid.x, mid.y);
          ctx.lineTo(t.pos.x, t.pos.y);
       }
       ctx.stroke();
    }
  }
}
