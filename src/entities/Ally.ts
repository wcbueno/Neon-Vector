
import { Vector } from '../core/Vector';
import { COLORS } from '../utils/Constants';
import { Player } from './Player';
import { Enemy } from './Enemy';
import { Bullet } from './Bullet';

export class Ally {
  pos: Vector;
  damage: number;
  fireRate: number;
  fireTimer: number;
  range: number;

  constructor(player: Player) {
    this.pos = player.pos.copy().sub(new Vector(50, 50));
    this.damage = 0;
    this.fireRate = 0;
    this.fireTimer = 0;
    this.range = 500; // Buffed range
    this.syncStats(player);
  }

  syncStats(player: Player) {
    // Buffed: Inherits 35% of player stats (was 20%)
    this.damage = Math.max(1, player.damage * 0.35);
    // Buffed: Fires as fast as player (was 20% slower)
    this.fireRate = Math.max(5, player.fireRate); 
  }

  update(player: Player, enemies: Enemy[]): Bullet | null {
    // Follow player with Lerp
    const targetPos = player.pos.add(new Vector(Math.cos(Date.now()/1000)*60, Math.sin(Date.now()/1000)*60));
    const dir = targetPos.sub(this.pos);
    this.pos = this.pos.add(dir.mult(0.1));

    // Auto-Aim Logic
    this.fireTimer++;
    if (this.fireTimer >= this.fireRate) {
      // Find nearest enemy
      let nearest: Enemy | null = null;
      let minDst = Infinity;
      
      for(const e of enemies) {
        const d = this.pos.dist(e.pos);
        if (d < this.range && d < minDst) {
          minDst = d;
          nearest = e;
        }
      }

      if (nearest) {
        this.fireTimer = 0;
        const aim = nearest.pos.sub(this.pos).norm().mult(10);
        return new Bullet(this.pos, aim, this.damage);
      }
    }
    return null;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = COLORS.ALLY;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, 10, 0, Math.PI*2);
    ctx.stroke();
    
    // Core
    ctx.fillStyle = COLORS.ALLY;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, 4, 0, Math.PI*2);
    ctx.fill();
  }
}
