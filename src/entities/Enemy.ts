
import { Vector } from '../core/Vector';
import { COLORS } from '../utils/Constants';
import { Player } from './Player';
import { Bullet } from './Bullet';

export type EnemyType = 
  'grunt' | 'speeder' | 'tank' | 'seeker' | 
  'swarmer' | 'brute' | 'sniper' | 'exploder' | 
  'waver' | 'teleporter' | 'turret' | 'orbit' | 
  'armored' | 'ghost' |
  'fractal' | 'mender' | 'lancer' | 'vortex' |
  'trailblazer' | 'layer' | 'beamer' | 'aegis' |
  'glitch' | 'carrier' |
  // New Types for Bosses
  'electric_speeder' | 'mini_monolith';

export class Enemy {
  pos: Vector;
  vel: Vector;
  type: EnemyType;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  size: number;
  color: string;
  xpValue: number;
  difficultyMult: number;

  // AI State
  state: 'chase' | 'prepare' | 'dash' | 'teleporting' | 'flee';
  stateTimer: number;
  dashDir: Vector;
  
  // Specific AI props
  fireTimer: number;
  fireRate: number;
  orbitAngle: number;
  pendingSpawns: Enemy[] = [];

  constructor(x: number, y: number, type: EnemyType, difficultyMult: number = 1.0) {
    this.pos = new Vector(x, y);
    this.vel = new Vector(0, 0);
    this.type = type;
    this.difficultyMult = difficultyMult;

    // AI Defaults
    this.state = 'chase';
    this.stateTimer = 0;
    this.dashDir = new Vector(0, 0);
    this.fireTimer = Math.random() * 100;
    this.fireRate = 0;
    this.orbitAngle = Math.random() * Math.PI * 2;

    // Base Stats
    switch (type) {
      case 'grunt': this.hp = 15; this.speed = 2.0; this.size = 20; this.damage = 8; this.xpValue = 10; this.color = COLORS.ENEMY_GRUNT; break;
      case 'speeder': this.hp = 10; this.speed = 3.2; this.size = 15; this.damage = 5; this.xpValue = 15; this.color = COLORS.ENEMY_SPEEDER; break;
      case 'tank': this.hp = 80; this.speed = 1.2; this.size = 35; this.damage = 15; this.xpValue = 40; this.color = COLORS.ENEMY_TANK; break;
      case 'seeker': this.hp = 30; this.speed = 1.8; this.size = 25; this.damage = 8; this.xpValue = 25; this.fireRate = 180; this.color = COLORS.ENEMY_SEEKER; break;
      case 'swarmer': this.hp = 5; this.speed = 3.8; this.size = 10; this.damage = 4; this.xpValue = 5; this.color = COLORS.ENEMY_SWARMER; break;
      case 'brute': this.hp = 150; this.speed = 0.8; this.size = 45; this.damage = 20; this.xpValue = 80; this.color = COLORS.ENEMY_BRUTE; break;
      case 'sniper': this.hp = 25; this.speed = 1.5; this.size = 20; this.damage = 20; this.xpValue = 35; this.fireRate = 220; this.color = COLORS.ENEMY_SNIPER; break;
      // Nerfed Exploder
      case 'exploder': this.hp = 15; this.speed = 2.2; this.size = 22; this.damage = 15; this.xpValue = 20; this.color = COLORS.ENEMY_EXPLODER; break;
      case 'waver': this.hp = 25; this.speed = 2.5; this.size = 18; this.damage = 8; this.xpValue = 20; this.color = COLORS.ENEMY_WAVER; break;
      case 'teleporter': this.hp = 40; this.speed = 1.0; this.size = 25; this.damage = 10; this.xpValue = 45; this.color = COLORS.ENEMY_TELEPORTER; break;
      case 'turret': this.hp = 80; this.speed = 0; this.size = 30; this.damage = 10; this.xpValue = 50; this.fireRate = 60; this.color = COLORS.ENEMY_TURRET; break;
      case 'orbit': this.hp = 35; this.speed = 2.2; this.size = 20; this.damage = 8; this.xpValue = 30; this.fireRate = 120; this.color = COLORS.ENEMY_ORBIT; break;
      case 'armored': this.hp = 200; this.speed = 0.9; this.size = 25; this.damage = 10; this.xpValue = 60; this.color = COLORS.ENEMY_ARMORED; break;
      case 'ghost': this.hp = 30; this.speed = 2.0; this.size = 22; this.damage = 12; this.xpValue = 30; this.color = COLORS.ENEMY_GHOST; break;
      case 'fractal': this.hp = 60; this.speed = 1.5; this.size = 30; this.damage = 10; this.xpValue = 50; this.color = COLORS.ENEMY_FRACTAL; break;
      case 'mender': this.hp = 50; this.speed = 2.5; this.size = 20; this.damage = 0; this.xpValue = 40; this.color = COLORS.ENEMY_MENDER; break;
      case 'lancer': this.hp = 35; this.speed = 2.0; this.size = 15; this.damage = 15; this.xpValue = 30; this.color = COLORS.ENEMY_LANCER; break;
      case 'vortex': this.hp = 120; this.speed = 0.5; this.size = 40; this.damage = 8; this.xpValue = 60; this.color = COLORS.ENEMY_VORTEX; break;
      case 'trailblazer': this.hp = 30; this.speed = 3.5; this.size = 15; this.damage = 8; this.xpValue = 35; this.fireRate = 20; this.color = COLORS.ENEMY_TRAILBLAZER; break;
      case 'layer': this.hp = 55; this.speed = 1.5; this.size = 25; this.damage = 10; this.xpValue = 40; this.fireRate = 180; this.color = COLORS.ENEMY_LAYER; break;
      case 'beamer': this.hp = 30; this.speed = 1.0; this.size = 20; this.damage = 18; this.xpValue = 30; this.fireRate = 240; this.color = COLORS.ENEMY_BEAMER; break;
      case 'aegis': this.hp = 400; this.speed = 0.6; this.size = 50; this.damage = 25; this.xpValue = 100; this.color = COLORS.ENEMY_AEGIS; break;
      case 'glitch': this.hp = 50; this.speed = 4.0; this.size = 20; this.damage = 12; this.xpValue = 50; this.fireRate = 45; this.color = COLORS.ENEMY_GLITCH; break;
      case 'carrier': this.hp = 300; this.speed = 0.8; this.size = 50; this.damage = 10; this.xpValue = 120; this.fireRate = 300; this.color = COLORS.ENEMY_CARRIER; break;
      
      // New Special Enemies
      case 'electric_speeder': this.hp = 30; this.speed = 5.0; this.size = 18; this.damage = 15; this.xpValue = 25; this.color = '#ffff00'; break;
      case 'mini_monolith': this.hp = 100; this.speed = 0; this.size = 30; this.damage = 10; this.xpValue = 0; this.fireRate = 90; this.color = '#4444ff'; break;
      
      default: this.hp = 15; this.speed = 2.0; this.size = 20; this.damage = 8; this.xpValue = 10; this.color = COLORS.ENEMY_GRUNT;
    }
    
    // Apply Difficulty Scaling
    this.hp *= difficultyMult;
    this.damage *= difficultyMult;
    this.xpValue = Math.ceil(this.xpValue * (1 + (difficultyMult - 1) * 0.5)); // XP scales slower than stats

    this.maxHp = this.hp;
  }

  update(player: Player, others: Enemy[]): Bullet | null {
    let bulletToFire: Bullet | null = null;
    const distToPlayer = this.pos.dist(player.pos);
    const vectorToPlayer = player.pos.sub(this.pos).norm();

    if (this.type === 'carrier') {
      this.vel = vectorToPlayer.mult(this.speed);
      this.fireTimer++;
      if (this.fireTimer > this.fireRate) {
        this.fireTimer = 0;
        for(let i=0; i<3; i++) {
           // Spawned minions inherit parent difficulty
           this.pendingSpawns.push(new Enemy(this.pos.x + (Math.random()-0.5)*20, this.pos.y + (Math.random()-0.5)*20, 'swarmer', this.difficultyMult));
        }
      }
    }
    else if (this.type === 'electric_speeder') {
        this.vel = vectorToPlayer.mult(this.speed);
        // Dash prediction logic? No, just raw speed.
    }
    else if (this.type === 'mini_monolith') {
        this.fireTimer++;
        if (this.fireTimer > this.fireRate) {
            this.fireTimer = 0;
            // Simple targeted shot
            bulletToFire = new Bullet(this.pos, vectorToPlayer.mult(6), this.damage, 5, 120, 1, true);
        }
    }
    else if (this.type === 'mender') {
      let target: Enemy | null = null;
      let minHpPct = 1.0;
      for(const other of others) {
        if (other !== this && other.hp < other.maxHp && other.type !== 'mender') {
          const pct = other.hp / other.maxHp;
          if (pct < minHpPct) {
            minHpPct = pct;
            target = other;
          }
        }
      }
      if (target) {
         const toTarget = target.pos.sub(this.pos);
         if (toTarget.mag() < 150) {
            target.hp = Math.min(target.maxHp, target.hp + 0.5);
            this.vel = new Vector(0,0);
         } else {
            this.vel = toTarget.norm().mult(this.speed);
         }
      } else {
         if (distToPlayer < 300) this.vel = vectorToPlayer.mult(-this.speed);
         else this.vel = this.vel.add(Vector.fromAngle(Math.random()*Math.PI*2).mult(0.2)).limit(this.speed);
      }
    }
    else if (this.type === 'lancer') {
      this.stateTimer++;
      if (this.state === 'chase') {
        const idealDir = vectorToPlayer;
        this.dashDir = this.dashDir.add(idealDir.mult(0.1)).norm();
        this.vel = this.dashDir.mult(this.speed);
        if (this.stateTimer > 90 && distToPlayer < 400) {
          this.state = 'prepare';
          this.stateTimer = 0;
          this.vel = new Vector(0,0);
          this.dashDir = vectorToPlayer;
        }
      } else if (this.state === 'prepare') {
        if (this.stateTimer > 45) {
          this.state = 'dash';
          this.stateTimer = 0;
        }
      } else if (this.state === 'dash') {
        this.vel = this.dashDir.mult(12);
        if (this.stateTimer > 20) {
          this.state = 'chase';
          this.stateTimer = 0;
          this.vel = this.vel.mult(0.1);
        }
      }
      if (this.dashDir.mag() === 0) this.dashDir = vectorToPlayer;
    }
    else if (this.type === 'vortex') {
      this.vel = vectorToPlayer.mult(this.speed);
    }
    else if (this.type === 'trailblazer') {
      if (Math.random() < 0.05) this.dashDir = Vector.fromAngle(Math.random()*Math.PI*2);
      const move = vectorToPlayer.mult(0.5).add(this.dashDir.mult(0.5)).norm();
      this.vel = move.mult(this.speed);
      this.fireTimer++;
      if (this.fireTimer > this.fireRate) {
        this.fireTimer = 0;
        bulletToFire = new Bullet(this.pos, new Vector(0,0), 5 * this.difficultyMult, 4, 180, 1, true);
      }
    }
    else if (this.type === 'layer') {
      if (distToPlayer < 400) this.vel = vectorToPlayer.mult(-this.speed);
      else this.vel = vectorToPlayer.mult(this.speed * 0.5);
      this.fireTimer++;
      if (this.fireTimer > this.fireRate) {
        this.fireTimer = 0;
        bulletToFire = new Bullet(this.pos, new Vector(0,0), 25 * this.difficultyMult, 8, 600, 1, true);
      }
    }
    else if (this.type === 'beamer') {
      const range = 400;
      if (distToPlayer > range) this.vel = vectorToPlayer.mult(this.speed);
      else this.vel = this.vel.mult(0.9);
      this.fireTimer++;
      if (this.fireTimer > this.fireRate) {
        this.fireTimer = 0;
        bulletToFire = new Bullet(this.pos, vectorToPlayer.mult(15), this.damage, 4, 120, 1, true);
      }
    }
    else if (this.type === 'glitch') {
      this.stateTimer++;
      if (this.stateTimer > 60) {
        this.stateTimer = 0;
        const offset = Vector.fromAngle(Math.random() * Math.PI * 2).mult(150 + Math.random() * 200);
        this.pos = player.pos.add(offset);
      }
      this.fireTimer++;
      if (this.fireTimer > this.fireRate) {
        this.fireTimer = 0;
        bulletToFire = new Bullet(this.pos, vectorToPlayer.mult(8), this.damage, 4, 120, 1, true);
      }
    }
    else if (this.type === 'turret') {
      this.fireTimer++;
      if (this.fireTimer >= this.fireRate) {
        if (distToPlayer < 600) {
          this.fireTimer = 0;
          bulletToFire = new Bullet(this.pos, vectorToPlayer.mult(6), this.damage, 4, 120, 1, true, player);
        }
      }
    } 
    else if (this.type === 'sniper') {
      const idealRange = 500;
      if (distToPlayer > idealRange + 50) this.vel = vectorToPlayer.mult(this.speed);
      else if (distToPlayer < idealRange - 50) this.vel = vectorToPlayer.mult(-this.speed);
      else this.vel = this.vel.mult(0.9);
      this.fireTimer++;
      if (this.fireTimer >= this.fireRate) {
        this.fireTimer = 0;
        bulletToFire = new Bullet(this.pos, vectorToPlayer.mult(12), this.damage, 4, 120, 1, true); 
      }
    }
    else if (this.type === 'orbit') {
      const perp = new Vector(-vectorToPlayer.y, vectorToPlayer.x);
      let pull = 0;
      if (distToPlayer > 300) pull = 0.5;
      if (distToPlayer < 200) pull = -0.5;
      const moveDir = perp.add(vectorToPlayer.mult(pull)).norm();
      this.vel = moveDir.mult(this.speed);
      this.fireTimer++;
      if (this.fireTimer >= this.fireRate) {
        this.fireTimer = 0;
        bulletToFire = new Bullet(this.pos, vectorToPlayer.mult(5), this.damage, 4, 120, 1, true, player);
      }
    }
    else if (this.type === 'teleporter') {
      this.stateTimer++;
      if (this.stateTimer > 120) { 
        this.stateTimer = 0;
        const offset = Vector.fromAngle(Math.random() * Math.PI * 2).mult(150);
        this.pos = player.pos.add(offset);
      } else {
        this.vel = vectorToPlayer.mult(this.speed);
      }
    }
    else if (this.type === 'waver') {
      this.stateTimer++;
      const sine = Math.sin(this.stateTimer * 0.1);
      const perp = new Vector(-vectorToPlayer.y, vectorToPlayer.x).mult(sine);
      this.vel = vectorToPlayer.add(perp).norm().mult(this.speed);
    }
    else if (this.type === 'exploder') {
      let s = this.speed;
      if (distToPlayer < 150) s *= 2.5;
      this.vel = vectorToPlayer.mult(s);
    }
    else if (this.type === 'speeder') {
      this.stateTimer++;
      if (this.state === 'chase') {
        this.vel = vectorToPlayer.mult(this.speed);
        if (this.stateTimer > 60 && Math.random() < 0.01) {
          this.state = 'prepare';
          this.stateTimer = 0;
          this.vel = new Vector(0,0);
          this.dashDir = vectorToPlayer;
        }
      } else if (this.state === 'prepare') {
        if (this.stateTimer > 40) {
          this.state = 'dash';
          this.stateTimer = 0;
          this.vel = this.dashDir.mult(this.speed * 4);
        }
      } else if (this.state === 'dash') {
        this.vel = this.vel.mult(0.96);
        if (this.stateTimer > 40) {
          this.state = 'chase';
          this.stateTimer = 0;
        }
      }
    }
    else if (this.type === 'seeker') {
      const idealRange = 350;
      if (distToPlayer > idealRange + 50) this.vel = vectorToPlayer.mult(this.speed);
      else if (distToPlayer < idealRange - 50) this.vel = vectorToPlayer.mult(-this.speed * 0.8);
      else this.vel = this.vel.mult(0.9);
      this.fireTimer++;
      if (this.fireTimer >= this.fireRate) {
        this.fireTimer = 0;
        bulletToFire = new Bullet(this.pos, vectorToPlayer.mult(4), this.damage, 4, 120, 1, true, player);
      }
    }
    else {
      this.vel = vectorToPlayer.mult(this.speed);
    }

    if (this.state !== 'dash' && this.type !== 'turret' && this.type !== 'ghost' && this.type !== 'vortex' && this.type !== 'mini_monolith') {
      for (const other of others) {
        if (other === this) continue;
        const d = this.pos.dist(other.pos);
        if (d < this.size + other.size) {
          const push = this.pos.sub(other.pos).norm();
          this.vel = this.vel.add(push.mult(0.5));
        }
      }
    }

    this.pos = this.pos.add(this.vel);
    
    return bulletToFire;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    
    const isLowHealth = this.hp < this.maxHp * 0.3;
    
    if (isLowHealth) {
      ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    }

    let fillColor = this.color;
    let strokeColor = isLowHealth ? '#ff0000' : '#ffffff';
    let lineWidth = isLowHealth ? 2 : 1;
    let shadowBlur = 0;
    
    if (isLowHealth) {
       const pulse = Math.sin(Date.now() / 80);
       if (pulse > 0.5) {
         fillColor = '#800000';
         strokeColor = '#ff0000';
       }
       shadowBlur = 10;
       ctx.shadowColor = '#ff0000';
    }

    if (this.type === 'ghost') {
      ctx.globalAlpha = 0.4 + (Math.sin(Date.now() / 500) * 0.2);
      shadowBlur = 10;
      strokeColor = this.color;
    } 
    else if (this.type === 'teleporter' || this.type === 'glitch') {
      if (Math.random() < 0.1) ctx.translate((Math.random()-0.5)*5, 0);
      if (this.type === 'glitch') fillColor = Math.random() < 0.5 ? '#000' : '#fff';
    } 
    else if (this.type === 'exploder') {
       const pulse = Math.abs(Math.sin(Date.now() / 100));
       fillColor = `rgba(255, ${69 + pulse * 100}, 0, 1)`;
       // Telegraph explosion
       if (pulse > 0.8) {
         shadowBlur = 20;
         ctx.shadowColor = '#ff4500';
       }
    }
    else if (this.type === 'vortex') {
       ctx.rotate(Date.now() / 200);
       shadowBlur = 15;
    }
    else if (this.type === 'beamer') {
      // Telegraph charging
      const pct = this.fireTimer / this.fireRate;
      if (pct > 0.7) {
         shadowBlur = 15 * pct;
         ctx.shadowColor = this.color;
      }
    }

    if (shadowBlur > 0 && !isLowHealth) ctx.shadowColor = this.color;

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.shadowBlur = shadowBlur;

    ctx.translate(this.pos.x, this.pos.y);

    if (this.state === 'prepare') {
      const pulse = (Math.sin(Date.now() / 50) + 1) / 2;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + (pulse * 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, this.size * (1.5 - pulse * 0.3), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for(let i=0; i<4; i++) {
        const angle = (Date.now()/200) + (Math.PI/2)*i;
        ctx.moveTo(Math.cos(angle) * this.size * 2, Math.sin(angle) * this.size * 2);
        ctx.lineTo(0,0);
      }
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    
    if ((this.state === 'prepare' && (this.type === 'speeder' || this.type === 'lancer'))) {
      ctx.rotate(Math.atan2(this.dashDir.y, this.dashDir.x));
      const beamAlpha = 0.3 + (Math.sin(Date.now()/50)+1)/4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(this.type === 'lancer' ? 500 : 300, 0); 
      ctx.strokeStyle = this.color; 
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      ctx.globalAlpha = beamAlpha;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    } 
    else if (this.vel.mag() > 0.1 && this.type !== 'turret' && this.type !== 'vortex' && this.type !== 'carrier' && this.type !== 'mini_monolith') {
       ctx.rotate(Math.atan2(this.vel.y, this.vel.x));
    }
    
    ctx.beginPath();
    const s = this.size;

    switch (this.type) {
      case 'electric_speeder': ctx.moveTo(s, 0); ctx.lineTo(-s, s/2); ctx.lineTo(-s, -s/2); ctx.stroke(); break;
      case 'mini_monolith': ctx.rect(-s/2, -s, s, s*2); break;
      case 'fractal': ctx.moveTo(s, 0); ctx.lineTo(s/2, s); ctx.lineTo(-s, s/2); ctx.lineTo(-s/2, -s); ctx.lineTo(s/2, -s/2); break;
      case 'mender': ctx.rect(-s/3, -s, s/1.5, s*2); ctx.rect(-s, -s/3, s*2, s/1.5); break;
      case 'lancer': ctx.moveTo(s*1.5, 0); ctx.lineTo(-s, s/3); ctx.lineTo(-s, -s/3); break;
      case 'vortex': for(let i=0; i<3; i++) { ctx.arc(0, 0, s - (i*5), i, Math.PI + i); } break;
      case 'trailblazer': ctx.moveTo(s, 0); ctx.lineTo(-s, s); ctx.lineTo(-s/2, 0); ctx.lineTo(-s, -s); break;
      case 'layer': ctx.moveTo(s/2, -s/2); ctx.lineTo(s, s/2); ctx.lineTo(-s, s/2); ctx.lineTo(-s/2, -s/2); break;
      case 'beamer': ctx.arc(0, 0, s, Math.PI/4, Math.PI*1.75); ctx.lineTo(0,0); break;
      case 'aegis': ctx.arc(0, 0, s, -Math.PI/2, Math.PI/2); ctx.lineTo(0, 0); break;
      case 'glitch': ctx.rect(-s/2, -s/2, s, s); ctx.moveTo(s, s); ctx.lineTo(-s, -s); break;
      case 'carrier': for(let i=0; i<5; i++) { const a = (i/5)*Math.PI*2 - Math.PI/2; ctx.lineTo(Math.cos(a)*s, Math.sin(a)*s); } break;
      case 'swarmer': ctx.moveTo(s, 0); ctx.lineTo(-s, s/2); ctx.lineTo(-s, -s/2); break;
      case 'brute': for(let i=0; i<8; i++) { const a=(i/8)*Math.PI*2; ctx.lineTo(Math.cos(a)*s, Math.sin(a)*s); } break;
      case 'sniper': ctx.rect(-s, -s/4, s*2, s/2); ctx.rect(-s/4, -s, s/2, s*2); break;
      case 'exploder': for(let i=0; i<16; i++) { const r=i%2===0?s:s/2; const a=(i/16)*Math.PI*2; ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r); } break;
      case 'waver': ctx.arc(0, 0, s/1.5, 0, Math.PI*2); break;
      case 'teleporter': ctx.rect(-s/2, -s/2, s, s); ctx.moveTo(s/2+5, -s/2+5); ctx.lineTo(s/2+5, s/2+5); ctx.lineTo(-s/2+5, s/2+5); break;
      case 'turret': for(let i=0; i<6; i++) { const r=i%2===0?s:s/2; const a=(i/6)*Math.PI*2; ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r); } break;
      case 'orbit': ctx.arc(0, 0, s/2, 0, Math.PI*2); ctx.moveTo(s, 0); ctx.arc(0, 0, s, 0, Math.PI*2); break;
      case 'armored': ctx.moveTo(-s/2, -s/2); ctx.lineTo(s/2, -s/2); ctx.lineTo(s/2, 0); ctx.lineTo(0, s); ctx.lineTo(-s/2, 0); break;
      case 'ghost': ctx.rect(-s/2, -s/2, s, s); break;
      case 'speeder': ctx.moveTo(s/2, 0); ctx.lineTo(-s/2, s/2.5); ctx.lineTo(-s/2, -s/2.5); break;
      case 'tank': for(let i=0; i<6; i++) { const a=(i/6)*Math.PI*2; ctx.lineTo(Math.cos(a)*s/1.5, Math.sin(a)*s/1.5); } break;
      case 'seeker': ctx.moveTo(0, -s/1.5); ctx.lineTo(s/1.5, 0); ctx.lineTo(0, s/1.5); ctx.lineTo(-s/1.5, 0); break;
      case 'grunt': default: ctx.rect(-s/2, -s/2, s, s); break;
    }
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (this.type === 'waver') {
      ctx.beginPath(); ctx.moveTo(-s, 0); ctx.bezierCurveTo(-s/2, s, s/2, -s, s, 0); ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    if (this.type === 'mender') {
       ctx.fillStyle = '#fff'; ctx.fillRect(-s/4, -s/4, s/2, s/2);
    }
    if (this.type === 'aegis') {
       ctx.beginPath(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.arc(0, 0, s, -Math.PI/2, Math.PI/2); ctx.stroke();
    }
    if (this.type === 'electric_speeder') {
       // Lightning bolt
       ctx.beginPath(); ctx.strokeStyle = '#fff'; ctx.moveTo(-s/2, -s/2); ctx.lineTo(0, 0); ctx.lineTo(-s/2, s/2); ctx.stroke();
    }
    
    if (isLowHealth) {
       ctx.beginPath(); 
       ctx.strokeStyle = '#000'; 
       ctx.lineWidth = 1; 
       ctx.moveTo(0, 0); ctx.lineTo(s/2, -s/2); 
       ctx.moveTo(0, 0); ctx.lineTo(-s/2, s/3); 
       ctx.moveTo(0, 0); ctx.lineTo(s/3, s/2);
       ctx.stroke();
    }

    ctx.restore();
  }
}
