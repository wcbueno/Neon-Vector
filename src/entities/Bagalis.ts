
import { Vector } from '../core/Vector';
import { Enemy } from './Enemy';
import { IBoss } from './Boss';
import { Particle } from './Particle';
import { soundManager } from '../core/SoundManager';

export class Bagalis {
  pos: Vector;
  state: 'dropping' | 'brawling' | 'leaving';
  timer: number;
  finished: boolean = false;
  
  targetPos: Vector;
  velocity: Vector;
  
  constructor(playerPos: Vector) {
    this.pos = playerPos.copy().add(new Vector(0, -1000));
    this.targetPos = playerPos.copy();
    this.state = 'dropping';
    this.timer = 0;
    this.velocity = new Vector(0, 0);
    soundManager.playBossSpawn(); // Heavy sound
  }

  update(enemies: Enemy[], bosses: IBoss[], particles: Particle[]) {
    this.timer++;
    
    if (this.state === 'dropping') {
        this.pos.y += 25; // Fall fast
        if (this.pos.y >= this.targetPos.y) {
            this.state = 'brawling';
            this.timer = 0;
            // Slam effect
            for(let i=0; i<30; i++) particles.push(new Particle(this.pos.x, this.pos.y, '#00ff00', 10, 8, 'spark'));
            soundManager.playExplosion();
        }
    } else if (this.state === 'brawling') {
        // Find nearest enemy and charge
        if (this.timer % 60 === 0) {
            const targets = [...enemies, ...bosses];
            let closest = null;
            let minDist = 600;
            for(const t of targets) {
                const d = t.pos.dist(this.pos);
                if(d < minDist) { minDist = d; closest = t; }
            }
            
            if (closest) {
                this.targetPos = closest.pos.copy();
                this.velocity = closest.pos.sub(this.pos).norm().mult(15);
            } else {
                this.velocity = new Vector(0,0);
            }
        }
        
        this.pos = this.pos.add(this.velocity);
        this.velocity = this.velocity.mult(0.9); // Friction
        
        // Collision logic
        const hitRadius = 50;
        const targets = [...enemies, ...bosses];
        for(const t of targets) {
            if (t.pos.dist(this.pos) < hitRadius) {
                t.hp -= 5; // Constant contact damage
                if (this.velocity.mag() > 5) {
                    t.hp -= 100; // Slam damage
                    particles.push(new Particle(t.pos.x, t.pos.y, '#ff8800', 5, 5));
                }
            }
        }
        
        if (this.timer > 1200) { // 20s
            this.state = 'leaving';
        }
    } else if (this.state === 'leaving') {
        this.pos.y -= 20;
        if (this.timer > 1260) this.finished = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00ff00';
    
    // Body
    ctx.fillStyle = '#225522';
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI*2);
    ctx.fill();
    
    // Spikes
    ctx.fillStyle = '#88ff00';
    for(let i=0; i<8; i++) {
        const a = (i/8)*Math.PI*2 + (this.timer * 0.1);
        const x = Math.cos(a) * 35;
        const y = Math.sin(a) * 35;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI*2);
        ctx.fill();
    }
    
    ctx.restore();
  }
}
