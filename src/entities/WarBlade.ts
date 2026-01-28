
import { Vector } from '../core/Vector';
import { Enemy } from './Enemy';
import { IBoss } from './Boss';
import { Particle } from './Particle';
import { soundManager } from '../core/SoundManager';

export class WarBlade {
  pos: Vector;
  targetPos: Vector;
  state: 'spawning' | 'slashing' | 'despawn';
  timer: number;
  rotation: number = 0;
  finished: boolean = false;
  damage: number = 150;
  
  constructor(playerPos: Vector) {
    this.pos = playerPos.copy().add(new Vector(0, -800));
    this.targetPos = playerPos.copy();
    this.state = 'spawning';
    this.timer = 0;
    soundManager.playPowerUp();
  }

  update(enemies: Enemy[], bosses: IBoss[], particles: Particle[]) {
    this.rotation += 0.5; // Fast spin
    this.timer++;

    if (this.state === 'spawning') {
       this.pos = this.pos.add(this.targetPos.sub(this.pos).mult(0.1));
       if (this.pos.dist(this.targetPos) < 20) {
         this.state = 'slashing';
         this.timer = 0;
         soundManager.playDash();
       }
    } else if (this.state === 'slashing') {
       // Dash between enemies
       if (this.timer % 15 === 0) {
          const targets = [...enemies, ...bosses];
          if (targets.length > 0) {
             const t = targets[Math.floor(Math.random() * targets.length)];
             
             // Trail
             const dist = t.pos.sub(this.pos);
             const steps = 5;
             for(let i=0; i<steps; i++) {
                const p = this.pos.add(dist.mult(i/steps));
                particles.push(new Particle(p.x, p.y, '#ff0033', 0, 20, 'spark'));
             }

             this.pos = t.pos.copy();
             t.hp -= this.damage;
             soundManager.playEnemyHit();
             particles.push(new Particle(t.pos.x, t.pos.y, '#ffffff', 5, 5, 'spark'));
          }
       }
       if (this.timer > 600) { // 10 seconds
          this.state = 'despawn';
       }
    } else if (this.state === 'despawn') {
       this.pos.y -= 30;
       if (this.timer > 650) this.finished = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.rotation);
    
    // Blade Visuals
    ctx.fillStyle = '#ff0033';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 20;
    
    // 3 Blades
    for(let i=0; i<3; i++) {
      ctx.rotate((Math.PI*2)/3);
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(-10, -60);
      ctx.lineTo(0, -80);
      ctx.lineTo(10, -60);
      ctx.fill();
    }
    
    // Center
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
  }
}
