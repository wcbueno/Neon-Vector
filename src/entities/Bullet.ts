
import { Vector } from '../core/Vector';
import { COLORS, WORLD_SIZE } from '../utils/Constants';
import { Player } from './Player';
import { Enemy } from './Enemy';
import { IBoss } from './Boss';

export class Bullet {
  pos: Vector;
  vel: Vector;
  damage: number;
  radius: number; // Used for Collision (Hitbox)
  visualRadius: number; // Used for Drawing
  life: number;
  piercing: number;
  isEnemy: boolean;
  target?: Player | Enemy | IBoss; 
  isCrit: boolean;
  knockback: number;
  bounces: number;
  blastRadius: number;
  homing: boolean = false; 
  
  hitIds: Set<Enemy | IBoss> = new Set();

  constructor(
    pos: Vector, 
    vel: Vector, 
    damage: number, 
    radius: number = 4,
    life: number = 120,
    piercing: number = 1,
    isEnemy: boolean = false, 
    target?: Player | Enemy | IBoss,
    isCrit: boolean = false,
    knockback: number = 0,
    bounces: number = 0,
    blastRadius: number = 0
  ) {
    this.pos = pos.copy();
    this.vel = vel;
    this.damage = damage;
    this.radius = radius;
    // Default visual radius to physical radius unless it's a boss bullet (large hitbox, smaller visual)
    this.visualRadius = isEnemy && radius > 8 ? radius * 0.6 : radius; 
    
    this.life = life;
    this.piercing = piercing;
    this.isEnemy = isEnemy;
    this.target = target;
    this.isCrit = isCrit;
    this.knockback = knockback;
    this.bounces = bounces;
    this.blastRadius = blastRadius;
  }

  update(enemies?: Enemy[]) {
    // Wall Bouncing
    if (this.bounces > 0) {
      let bounced = false;
      if (this.pos.x <= 0 || this.pos.x >= WORLD_SIZE) {
        this.vel.x *= -1;
        bounced = true;
      }
      if (this.pos.y <= 0 || this.pos.y >= WORLD_SIZE) {
        this.vel.y *= -1;
        bounced = true;
      }
      if (bounced) {
        this.bounces--;
      }
    }

    // Target Acquisition for Homing Bullets
    if (this.homing && !this.target && enemies && !this.isEnemy) {
        let closest: Enemy | undefined;
        let minDst = 600;
        for (const e of enemies) {
            const d = this.pos.dist(e.pos);
            if (d < minDst && e.hp > 0) {
                minDst = d;
                closest = e;
            }
        }
        this.target = closest;
    }

    // Homing Logic
    if (this.target) {
      // Check if target is dead
      if ('hp' in this.target && this.target.hp <= 0) {
         this.target = undefined;
         
         // Retarget logic
         if (enemies && !this.isEnemy) {
            let closest: Enemy | undefined;
            let minDst = 400; 
            for (const e of enemies) {
                const d = this.pos.dist(e.pos);
                if (d < minDst && e.hp > 0) {
                    minDst = d;
                    closest = e;
                }
            }
            this.target = closest;
         }
      } 
      
      if (this.target) {
        const currentSpeed = this.vel.mag();
        const desiredDir = this.target.pos.sub(this.pos).norm();
        const steerStrength = 0.35; 
        this.vel = this.vel.add(desiredDir.mult(steerStrength));
        this.vel = this.vel.norm().mult(currentSpeed);
      }
    }

    // Standard Physics
    this.pos = this.pos.add(this.vel);
    this.life--;
  }

  hasHit(enemy: Enemy | IBoss): boolean {
    return this.hitIds.has(enemy);
  }

  registerHit(enemy: Enemy | IBoss) {
    this.hitIds.add(enemy);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    
    // Determine color
    let color = this.isEnemy ? COLORS.ENEMY_GRUNT : COLORS.BULLET;
    if (this.target && this.isEnemy) color = '#ffaa00'; 
    if (this.isCrit && !this.isEnemy) color = '#ffff00';

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = this.isCrit ? 15 : 8; 
    
    ctx.beginPath();
    // Use visualRadius for drawing
    const r = this.visualRadius;
    ctx.moveTo(this.pos.x, this.pos.y - r);
    ctx.lineTo(this.pos.x + r, this.pos.y);
    ctx.lineTo(this.pos.x, this.pos.y + r);
    ctx.lineTo(this.pos.x - r, this.pos.y);
    ctx.closePath();
    ctx.fill();

    if (r > 3) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Debug: Show Hitbox if it's an enemy bullet significantly larger than visual
    /*
    if (this.isEnemy && this.radius > this.visualRadius + 2) {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI*2);
        ctx.stroke();
    }
    */

    ctx.restore();
  }
}