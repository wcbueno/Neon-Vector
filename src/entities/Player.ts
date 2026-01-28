
import { Vector } from '../core/Vector';
import { Input } from '../core/Input';
import { COLORS, CONSTANTS, WORLD_SIZE, PLAYER_CAPS } from '../utils/Constants';
import { Bullet } from './Bullet';
import { Enemy } from './Enemy';
import { soundManager } from '../core/SoundManager';

export class Player {
  pos: Vector;
  vel: Vector;
  hp: number;
  maxHp: number;
  xp: number;
  xpToNextLevel: number;
  level: number;

  // Core Stats
  speed: number;
  damage: number;
  fireRate: number;
  regen: number;
  pickupRange: number;

  // Crit Stats
  critChance: number;
  critMult: number;

  // Weapon Stats
  projectileCount: number;
  spread: number;
  piercing: number;
  bulletSpeed: number;
  bulletSize: number;
  bulletLife: number;
  knockback: number;

  // Shooting Modifiers
  bulletBounces: number;
  bulletHoming: boolean;
  blastRadius: number; // Area Damage Radius

  // State
  lastShot: number;
  regenTimer: number; // For Regen Delay
  readonly MAX_HP_CAP: number = 500;

  // Abilities
  dashCooldown: number = 0;
  dashCooldownMult: number = 1.0; // Redutor de Cooldown do Dash
  dashMaxCooldown: number = 60; // O tempo total padrão (60 frames = 1 seg)
  dashDuration: number;
  dashInvulnDuration: number;
  dashDamage: number;
  passivePowers: string[] = [];   // Lista para guardar nomes das passivas (Drones, Aura)

  //Novos Atributos
  xpMult: number = 1.0;           // Multiplicador de XP
  magnetRadius: number = 0;       // Bônus de coleta
  projectiles: number = 1;        // Quantidade de balas (Multishot)

  // Flags de Estado para Upgrades Especiais
  public hasMemoryLeak: boolean = false; // Perde XP constantemente
  public hasSegFault: boolean = false;   // Toma +50% de dano
  public vampirism: boolean = false;     // Cura ao matar
  public staticFriction: boolean = false; // Gera raio ao correr

  // Multi-Skill System
  activeSkills: string[] = [];
  skillCooldown: number;
  skillMaxCooldown: number;

  // Status Effects
  invulnerable: number;
  overloadTimer: number; // For Overload power
  hasPlasmaAura: boolean;

  // New Status Effects
  stunTimer: number = 0;
  slowTimer: number = 0;
  stunCooldown: number = 0;

  // Visual State
  trail: Vector[] = [];
  rotation: number = 0;
  recoil: number = 0;

  constructor() {
    this.pos = new Vector(WORLD_SIZE / 2, WORLD_SIZE / 2);
    this.vel = new Vector(0, 0);
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.xp = 0;
    this.xpToNextLevel = 100;
    this.level = 1;

    // Base Stats
    this.speed = CONSTANTS.MAX_SPEED_BASE;
    this.damage = 10;
    this.fireRate = 12; // Frames per shot
    this.regen = 0;
    this.pickupRange = 100;

    this.critChance = 0.05;
    this.critMult = 1.5;

    this.projectileCount = 1;
    this.spread = 0;
    this.piercing = 1;
    this.bulletSpeed = 12;
    this.bulletSize = 4;
    this.bulletLife = 120;
    this.knockback = 0;

    this.bulletBounces = 0;
    this.bulletHoming = false;
    this.blastRadius = 0;

    this.lastShot = 0;
    this.regenTimer = 0;

    // Dash (Native)
    this.dashCooldown = 0;
    this.dashMaxCooldown = 180; // 3 seconds
    this.dashDuration = 15; // Frames of actual movement lock/burst
    this.dashInvulnDuration = 20; // Frames of iframes
    this.dashDamage = 0; // Damage dealt when dashing through enemies

    // Ultimate
    this.activeSkills = [];
    this.skillCooldown = 0;
    this.skillMaxCooldown = 0;

    this.invulnerable = 0;
    this.overloadTimer = 0;
    this.hasPlasmaAura = false;
  }

  get isDashing(): boolean {
    return this.dashCooldown > this.dashMaxCooldown - this.dashDuration;
  }

  // Enforces Stat Caps and returns true if an overflow occurred
  enforceCaps(): boolean {
    let overflow = false;

    if (this.speed > PLAYER_CAPS.MAX_SPEED) {
      this.speed = PLAYER_CAPS.MAX_SPEED;
      overflow = true;
    }

    if (this.damage > PLAYER_CAPS.MAX_DAMAGE) {
      this.damage = PLAYER_CAPS.MAX_DAMAGE;
      overflow = true;
    }

    if (this.pickupRange > PLAYER_CAPS.MAX_PICKUP_RANGE) {
      this.pickupRange = PLAYER_CAPS.MAX_PICKUP_RANGE;
      overflow = true;
    }

    return overflow;
  }

  takeDamage(amount: number) {
    if (this.stunCooldown <= 0) {
      this.stunTimer = 10;
      this.stunCooldown = 60; // Fica imune a travar por 1 segundo
    }

    if (this.hasSegFault) {
      amount *= 1.5; // O "Erro": Dano recebido aumentado em 50%
    }
    this.hp -= amount;
    this.regenTimer = 180; // Reset regen timer to 3 seconds (60fps * 3)
  }

  applyStun(duration: number) {
    this.stunTimer = Math.max(this.stunTimer, duration);
  }

  applySlow(duration: number) {
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  equipSkill(name: string) {
    if (!this.activeSkills.includes(name)) {
      this.activeSkills.push(name);
    }

    // Recalculate max cooldown (uses the highest cooldown of all equipped skills)
    let maxCD = 0;

    this.activeSkills.forEach(skill => {
      let cd = 0;
      switch (skill) {
        case 'shockwave': cd = 300; break;
        case 'overload': cd = 600; break;
        case 'time_warp': cd = 900; break;
        case 'missile_swarm': cd = 450; break;
        case 'black_hole': cd = 900; break;
      }
      if (cd > maxCD) maxCD = cd;
    });

    this.skillMaxCooldown = maxCD;
    // Ready immediately upon equip
    this.skillCooldown = 0;
  }

  findNearestEnemy(enemies: Enemy[]): Enemy | undefined {
    let nearest: Enemy | undefined;
    let minDist = Infinity;
    for (const e of enemies) {
      const d = this.pos.dist(e.pos);
      if (d < 600 && d < minDist) { // 600 range check
        minDist = d;
        nearest = e;
      }
    }
    return nearest;
  }

  update(input: Input, enemies: Enemy[]): Bullet[] {

    // Status Effects
    if (this.stunTimer > 0) this.stunTimer--;
    if (this.slowTimer > 0) this.slowTimer--;

    if (this.hasMemoryLeak) {
      // Perde um pouco de XP todo frame.
      // Se a XP chegar a 0, não perde nível (para não ser cruel demais), só zera a barra.
      if (this.xp > 0) {
        this.xp -= 0.15; // Ajuste este valor para drenar mais rápido ou devagar
      }
    }

    // Regen (with Delay)
    if (this.regenTimer > 0) {
      this.regenTimer--;
    } else if (this.regen > 0 && this.hp < this.maxHp) {
      this.hp += this.regen / 60;
      if (this.hp > this.maxHp) this.hp = this.maxHp;
    }

    // Cooldowns
    if (this.dashCooldown > 0) this.dashCooldown--;
    if (this.skillCooldown > 0) this.skillCooldown--;
    if (this.overloadTimer > 0) this.overloadTimer--;
    if (this.recoil > 0) this.recoil *= 0.8;
    if (this.invulnerable > 0) this.invulnerable--;

    // 1. Movement & Dash
    // Input blocked while stunned
    const moveDir = this.stunTimer > 0 ? new Vector(0, 0) : input.getMovementVector();
    let currentSpeed = this.speed;

    // Apply Slow
    if (this.slowTimer > 0) currentSpeed *= 0.5;

    // Dash Activation (Shift)
    if (input.shiftPressed && this.dashCooldown <= 0 && moveDir.mag() > 0 && this.stunTimer <= 0) {
      this.dashCooldown = this.dashMaxCooldown;
      this.invulnerable = this.dashInvulnDuration;
      soundManager.playDash();
      // Dash burst velocity
      this.vel = moveDir.mult(25);
    }

    // Dash State
    if (this.isDashing) {
      // Dashing frames
      currentSpeed = 0; // Physics overrides manual input during dash burst
      if (this.dashCooldown % 2 === 0) this.trail.push(this.pos.copy());
    }

    // Standard Trail
    if (moveDir.mag() > 0 && this.vel.mag() > 5) {
      if (Math.random() < 0.3) this.trail.push(this.pos.copy());
    }
    if (this.trail.length > 8) this.trail.shift();

    // Physics
    if (moveDir.mag() > 0 && !this.isDashing) {
      this.vel = this.vel.add(moveDir.mult(CONSTANTS.ACCELERATION));
    }

    this.vel = this.vel.mult(CONSTANTS.FRICTION);
    this.vel = this.vel.limit(this.isDashing ? 30 : currentSpeed);
    this.pos = this.pos.add(this.vel);

    // Bounds
    this.pos.x = Math.max(0, Math.min(WORLD_SIZE, this.pos.x));
    this.pos.y = Math.max(0, Math.min(WORLD_SIZE, this.pos.y));

    // 2. Shooting
    const generatedBullets: Bullet[] = [];

    // Prevent shooting while stunned
    if (this.stunTimer <= 0) {
      this.lastShot++;

      // Calculate effective Fire Rate
      let currentFireRate = this.fireRate;
      if (this.overloadTimer > 0) currentFireRate = Math.max(2, this.fireRate * 0.25); // 4x speed

      // Input Handling (Mouse Only now)
      let isFiring = input.mouseDown;
      let aimDir = input.mouse.sub(this.pos).norm();

      if (isFiring && this.lastShot >= currentFireRate) {
        this.lastShot = 0;
        this.recoil = 5;
        soundManager.playShoot();

        // Push back
        this.vel = this.vel.sub(aimDir.mult(0.5));

        const baseAngle = Math.atan2(aimDir.y, aimDir.x);

        const createBullet = (angle: number) => {
          const velocity = Vector.fromAngle(angle).mult(this.bulletSpeed);

          const isCrit = Math.random() < this.critChance;
          const finalDamage = this.damage * (isCrit ? this.critMult : 1);

          let target: Enemy | undefined = undefined;
          if (this.bulletHoming) {
            target = this.findNearestEnemy(enemies);
          }

          const b = new Bullet(
            this.pos.add(velocity.norm().mult(10)),
            velocity,
            finalDamage,
            this.bulletSize * (isCrit ? 1.5 : 1),
            this.bulletLife,
            this.piercing,
            false,
            target,
            isCrit,
            this.knockback,
            this.bulletBounces,
            this.blastRadius
          );

          generatedBullets.push(b);
        };

        // Main Projectiles
        for (let i = 0; i < this.projectiles; i++) {
          let offset = 0;

          if (this.projectiles > 1) {
            // Define um espalhamento fixo (leque) de ~12 graus (0.2 radianos)
            const totalSpread = 0.2;

            // Calcula o passo para distribuir as balas igualmente
            const step = totalSpread / (this.projectiles - 1);

            // Centraliza o leque
            offset = -totalSpread / 2 + step * i;
          }

          createBullet(baseAngle + offset);
        }
      }
    }

    this.rotation += 0.05 + (this.vel.mag() * 0.02);

    return generatedBullets;
  }

  gainXp(amount: number) {
    if (this.level < 10) {
      amount *= 2.0; // BUFF: 2x XP gain for first 10 levels
    }
    this.xp += amount;
  }

  checkLevelUp(): boolean {
    if (this.xp >= this.xpToNextLevel) {
      this.level++;
      this.xp -= this.xpToNextLevel;
      // XP CURVE UPDATE: Reduced scaling from 1.2 to 1.1 + reduced flat amount
      this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.1) + 25;
      this.hp = this.maxHp;
      soundManager.playPowerUp();
      return true;
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const isInvuln = this.invulnerable > 0;
    const isStunned = this.stunTimer > 0;

    // --- 1. TRAIL ---
    if (this.trail.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        const xc = (this.trail[i].x + this.trail[i - 1].x) / 2;
        const yc = (this.trail[i].y + this.trail[i - 1].y) / 2;
        ctx.quadraticCurveTo(this.trail[i - 1].x, this.trail[i - 1].y, xc, yc);
      }
      ctx.lineTo(this.pos.x, this.pos.y);
      ctx.strokeStyle = isInvuln ? '#fff' : COLORS.PLAYER;
      ctx.lineWidth = isInvuln ? 4 : 2;
      ctx.globalAlpha = 0.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // --- 2. PLASMA AURA ---
    if (this.hasPlasmaAura) {
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.beginPath();
      ctx.arc(0, 0, 100, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 100) * 0.1;
      ctx.stroke();
      ctx.fillStyle = '#ff00ff';
      ctx.globalAlpha = 0.05;
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    // --- 3. OVERLOAD & GLOW ---
    if (this.overloadTimer > 0) {
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 20 + Math.random() * 20;
    } else {
      ctx.shadowBlur = isInvuln ? 30 : 15;
      ctx.shadowColor = isInvuln ? '#ffffff' : COLORS.PLAYER;
    }

    // --- 4. EVOLUTION STAGES ---

    // Base size grows slightly with health upgrades
    const baseSize = 16 + Math.min(8, this.maxHp / 60);

    // ORBITALS (Projectiles)
    const orbitRadius = baseSize + 20 - this.recoil;
    for (let i = 0; i < this.projectileCount; i++) {
      const a = (i / this.projectileCount) * Math.PI * 2 + this.rotation;
      const mx = Math.cos(a) * orbitRadius;
      const my = Math.sin(a) * orbitRadius;

      ctx.fillStyle = this.overloadTimer > 0 ? '#ffaa00' : (isInvuln ? '#fff' : COLORS.PLAYER);
      ctx.beginPath();
      // Little diamonds
      ctx.moveTo(mx + 4, my);
      ctx.lineTo(mx, my + 4);
      ctx.lineTo(mx - 4, my);
      ctx.lineTo(mx, my - 4);
      ctx.fill();
    }

    // MAIN BODY DRAWING
    ctx.fillStyle = isInvuln ? '#ffffff' : '#000000';
    // Stun Visual: Yellow/Black flicker
    if (isStunned && Math.floor(Date.now() / 50) % 2 === 0) {
      ctx.strokeStyle = '#ffff00';
    } else {
      ctx.strokeStyle = this.overloadTimer > 0 ? '#ffaa00' : COLORS.PLAYER;
    }

    ctx.lineWidth = 2;

    // Rotate core shape
    ctx.rotate(this.rotation);

    // Stage 1: The Virus (Levels 1-9) - Sharp Triangle
    if (this.level < 10) {
      this.drawPolygon(ctx, 3, baseSize + this.recoil);
      ctx.fillStyle = this.overloadTimer > 0 ? '#ffaa00' : COLORS.PLAYER;
      ctx.beginPath();
      ctx.arc(0, 0, baseSize / 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Stage 2: The Malware (Levels 10-19) - Aggressive Square with Rotors
    else if (this.level < 20) {
      // Outer rotor
      ctx.save();
      ctx.rotate(-this.rotation * 2); // Counter rotate
      ctx.strokeStyle = COLORS.PLAYER;
      ctx.lineWidth = 1;
      this.drawPolygon(ctx, 4, baseSize + 8, false);
      ctx.restore();

      // Core
      this.drawPolygon(ctx, 4, baseSize + this.recoil);

      // Inner X
      ctx.beginPath();
      ctx.moveTo(-baseSize / 2, -baseSize / 2); ctx.lineTo(baseSize / 2, baseSize / 2);
      ctx.moveTo(baseSize / 2, -baseSize / 2); ctx.lineTo(-baseSize / 2, baseSize / 2);
      ctx.strokeStyle = this.overloadTimer > 0 ? '#ffaa00' : COLORS.PLAYER;
      ctx.stroke();
    }
    // Stage 3: The Corruptor (Levels 20-29) - Hexagon with Pulse Rings
    else if (this.level < 30) {
      // Pulse Ring
      const pulse = Math.sin(Date.now() / 200) * 2;
      ctx.beginPath();
      ctx.arc(0, 0, baseSize + 10 + pulse, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.PLAYER;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      this.drawPolygon(ctx, 6, baseSize + this.recoil); // Hexagon

      // Inner detail
      ctx.fillStyle = this.overloadTimer > 0 ? '#ffaa00' : COLORS.PLAYER;
      ctx.beginPath();
      ctx.arc(0, 0, baseSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Stage 4: System Override (Level 30+) - Complex Octagon God Mode
    else {
      // Rotating outer shells
      ctx.save();
      ctx.rotate(Date.now() / 400);
      ctx.strokeStyle = this.overloadTimer > 0 ? '#ff0000' : '#00ffff';
      this.drawPolygon(ctx, 8, baseSize + 16, false);
      ctx.restore();

      ctx.save();
      ctx.rotate(-Date.now() / 400);
      ctx.strokeStyle = COLORS.PLAYER;
      this.drawPolygon(ctx, 8, baseSize + 12, false);
      ctx.restore();

      // Solid Core
      this.drawPolygon(ctx, 8, baseSize + this.recoil);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, baseSize / 2, 0, Math.PI * 2); ctx.fill();

      // Energy spikes
      if (Math.random() < 0.2) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const angle = Math.random() * Math.PI * 2;
        ctx.lineTo(Math.cos(angle) * baseSize * 3, Math.sin(angle) * baseSize * 3);
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
    }

    if (isStunned) {
      // Stun stars
      ctx.fillStyle = '#ffff00';
      for (let i = 0; i < 3; i++) {
        const a = Date.now() / 200 + (i * Math.PI * 2 / 3);
        const sx = Math.cos(a) * (baseSize + 10);
        const sy = Math.sin(a) * (baseSize + 10);
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
      }
    }

    ctx.restore();
  }

  // Helper for drawing shapes
  drawPolygon(ctx: CanvasRenderingContext2D, sides: number, radius: number, fill: boolean = true) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (Math.PI * 2 * i) / sides - Math.PI / 2; // Start at top
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (fill) {
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.stroke();
    }
  }
}