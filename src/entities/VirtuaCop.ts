
import { Vector } from '../core/Vector';
import { Enemy } from './Enemy';
import { IBoss } from './Boss';
import { Particle } from './Particle';
import { Bullet } from './Bullet';
import { soundManager } from '../core/SoundManager';

export class VirtuaCop {
  pos: Vector;
  targetPos: Vector;
  state: 'arriving' | 'patrol' | 'departing';
  timer: number;
  rotation: number = 0;
  finished: boolean = false;
  
  fireTimer: number = 0;
  burstCount: number = 0;
  
  constructor(playerPos: Vector) {
    this.pos = playerPos.copy().sub(new Vector(0, 800));
    this.targetPos = playerPos.copy().add(new Vector(100, -100));
    this.state = 'arriving';
    this.timer = 0;
    soundManager.playPowerUp();
  }

  update(enemies: Enemy[], bosses: IBoss[], playerPos: Vector): Bullet | null {
    this.timer++;
    this.rotation += 0.05;
    
    // Smooth follow
    const idealPos = playerPos.add(new Vector(Math.cos(this.timer*0.02)*120, Math.sin(this.timer*0.02)*120));
    
    if (this.state === 'arriving') {
        this.pos = this.pos.add(idealPos.sub(this.pos).mult(0.05));
        if (this.pos.dist(idealPos) < 50) {
            this.state = 'patrol';
            this.timer = 0;
        }
    } else if (this.state === 'patrol') {
        this.pos = this.pos.add(idealPos.sub(this.pos).mult(0.1));
        
        // Firing Logic
        this.fireTimer++;
        if (this.fireTimer > 40) {
            // Burst Fire
            if (this.fireTimer % 5 === 0 && this.burstCount < 3) {
                this.burstCount++;
                const targets = [...enemies, ...bosses];
                // Find closest
                let closest = null;
                let minDist = 800;
                for(const t of targets) {
                    const d = t.pos.dist(this.pos);
                    if(d < minDist) { minDist = d; closest = t; }
                }
                
                if (closest) {
                    soundManager.playShoot();
                    return new Bullet(
                        this.pos.copy(), 
                        closest.pos.sub(this.pos).norm().mult(15), // High speed
                        35, // High Damage
                        6, 
                        100, 
                        2
                    );
                }
            }
            if (this.burstCount >= 3) {
                this.burstCount = 0;
                this.fireTimer = 0;
            }
        }
        
        if (this.timer > 1200) { // 20 seconds
            this.state = 'departing';
        }
    } else if (this.state === 'departing') {
        this.pos.y -= 15;
        if (this.timer > 1260) this.finished = true;
    }
    
    return null;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    
    // Siren Effect
    if (Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.shadowColor = '#f00';
    } else {
        ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
        ctx.shadowColor = '#00f';
    }
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI*2);
    ctx.fill();
    
    // Drone Body
    ctx.rotate(this.rotation);
    ctx.fillStyle = '#eee';
    ctx.shadowBlur = 0;
    ctx.fillRect(-15, -15, 30, 30);
    
    ctx.fillStyle = '#333';
    ctx.fillRect(-10, -5, 20, 10);
    
    ctx.restore();
  }
}
