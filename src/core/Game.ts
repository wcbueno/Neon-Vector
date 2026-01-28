import { Vector } from './Vector';
import { Input } from './Input';
import { Player } from '../entities/Player';
import { Enemy, EnemyType } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { Particle } from '../entities/Particle';
import { Orb } from '../entities/Orb';
import { IBoss, WaveChief, Cursor, Monolith } from '../entities/Boss';
import { Ally } from '../entities/Ally';
import { AZBoxThunder } from '../entities/AZBoxThunder';
import { WarBlade } from '../entities/WarBlade';
import { VirtuaCop } from '../entities/VirtuaCop';
import { Bagalis } from '../entities/Bagalis';
import { AreaEffect } from '../entities/AreaEffect';
import { FloatingText } from '../entities/FloatingText';
import { CONSTANTS, COLORS, WORLD_SIZE, TILE_SIZE } from '../utils/Constants';
import { Upgrade, getWeightedUpgrades } from '../utils/Upgrades';
import { POWERS, Power } from '../utils/Powers';
import { SpatialHash } from './SpatialHash';
import { soundManager } from './SoundManager';

// --- INTERFACE HUD ---
export interface HUDProps {
  hp: number;
  maxHp: number;
  score: number;
  level: number;
  xp: number;
  xpMax?: number;
  
  activeSkills: string[];
  passivePowers: string[];

  dashCooldown: number;
  dashMaxCooldown: number;
  
  combo: number;
  comboTimer: number;
  maxComboTimer: number;
  wave: number;
  bossActive: boolean;
}

interface GameCallbacks {
  onGameOver: (score: number, maxCombo: number) => void;
  onLevelUp: (options: (Upgrade | Power)[]) => void;
  onUpdateHUD: (stats: HUDProps) => void;
  onBossSpawn: (name: string) => void;
}

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  input: Input;
  callbacks: GameCallbacks;

  player: Player;
  enemies: Enemy[] = [];
  pendingEnemies: Enemy[] = [];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  orbs: Orb[] = [];

  // Boss Arrays
  chiefs: WaveChief[] = [];
  bosses: IBoss[] = [];

  texts: FloatingText[] = [];
  allies: Ally[] = [];

  // Special Allies
  azBox: AZBoxThunder | null = null;
  warBlade: WarBlade | null = null;
  virtuaCop: VirtuaCop | null = null;
  bagalis: Bagalis | null = null;

  // Persistent Effects
  areaEffects: AreaEffect[] = [];

  camera: Vector;
  score: number = 0;
  isRunning: boolean = false;
  isPaused: boolean = false;

  // Wave System
  wave: number = 1;
  waveTimer: number = 0;
  waveEventActive: boolean = false;
  readonly WAVE_DURATION: number = 3600;

  screenShake: number = 0;
  globalPulse: number = 0;
  lastBossSpawnedAtLevel: number = 0;
  lastBossSpawnLevel: number = 0;
  levelUpFlash: number = 0;
  hitStopTimer: number = 0;

  // Boss Intro State
  bossIntroTimer: number = 0;
  bossIntroTotalTime: number = 180;
  pendingBoss: IBoss | null = null;
  bossSpawnLocation: Vector | null = null;

  // Combo System
  combo: number = 0;
  comboTimer: number = 0;
  comboMaxTimer: number = 240;
  maxCombo: number = 0;

  // Powers State
  timeWarpTimer: number = 0;

  // Enemy Scaling
  enemyBuffStrength: number = 0;

  // Optimization
  enemySpatialHash: SpatialHash<Enemy>;

  // Time step control
  lastTime: number = 0;
  accumulator: number = 0;
  readonly fixedTimeStep: number = 1000 / 60;
  readonly maxUpdatesPerFrame: number = 10;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.input = new Input();
    this.callbacks = callbacks;
    this.player = new Player();
    this.camera = new Vector(0, 0);

    // FIX: Tipagem explícita <Enemy> para evitar erro no SpatialHash
    this.enemySpatialHash = new SpatialHash<Enemy>(150);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  async start() {
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;

    await soundManager.init();

    requestAnimationFrame(this.loop);
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    soundManager.setPauseState(this.isPaused);
    this.lastTime = performance.now();
  }

  spawnAlly() {
    if (this.allies.length < 3) {
      const offset = new Vector((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50);
      const newAlly = new Ally(this.player);
      newAlly.pos = this.player.pos.add(offset);
      this.allies.push(newAlly);

      this.callbacks.onBossSpawn("DRONE SUPPORT DEPLOYED");
    } else {
      this.score += 1000;
      this.texts.push(new FloatingText(this.player.pos.x, this.player.pos.y, "MAX DRONES!", '#ffff00', 20));
    }
  }

  // Handles installation of upgrades, including the Overflow Buff mechanic
  installUpgrade(option: Upgrade | Power) {
    if ('apply' in option && typeof option.apply === 'function') {
      option.apply(this.player);

      // Overflow Check: If stat is capped, buff enemies
      const isOverflow = this.player.enforceCaps();
      if (isOverflow) {
        this.enemyBuffStrength += 0.1; // +10% Enemy Buff
        this.texts.push(new FloatingText(this.player.pos.x, this.player.pos.y - 80, "STAT CAPPED! ENEMIES BUFFED!", '#ff0000', 20));
        soundManager.playBossSpawn(); // Warning sound
      }

    } else {
      this.applyPower(option.id);
    }
  }

  applyPower(powerId: string) {
    const power = POWERS.find(p => p.id === powerId);
    if (!power) return;

    if (power.type === 'passive') {

      if (power.id === 'ally_drone') {
        this.spawnAlly();

        if (!this.player.passivePowers.includes(powerId)) {
          this.player.passivePowers.push(powerId);
        }
      }
      else {
        if (!this.player.passivePowers.includes(powerId)) {
          this.player.passivePowers.push(powerId);
        }
      }
    }
  }

  loop = (timestamp: number) => {
    if (!this.isRunning) return;

    // Always calculate time, but conditionally accumulate
    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    if (!this.isPaused) {
      // --- LÓGICA DO HIT STOP ---
      if (this.hitStopTimer > 0) {
        this.hitStopTimer--;
        this.draw();
        requestAnimationFrame(this.loop);
        return;
      }

      this.accumulator += deltaTime;
      if (this.accumulator > 250) this.accumulator = 250;

      let updates = 0;
      while (this.accumulator >= this.fixedTimeStep) {
        this.update();
        this.accumulator -= this.fixedTimeStep;

        updates++;
        if (updates >= this.maxUpdatesPerFrame) {
          this.accumulator = 0;
          break;
        }
      }
      this.draw();
    } else {
      this.draw();
    }
    requestAnimationFrame(this.loop);
  };

  update() {
    // Sync Health to SoundManager for dynamic music
    soundManager.setHealth(this.player.hp, this.player.maxHp);

    // --- BOSS CINEMATIC SEQUENCE ---
    if (this.bossIntroTimer > 0) {
      this.bossIntroTimer--;
      this.screenShake = 5 + (Math.sin(this.bossIntroTimer * 0.5) * 2);

      // Clear enemies during intro
      if (this.bossIntroTimer === 60) {
        // Visual wipe effect logic happens in draw, data wipe here
        this.enemies = [];
        this.enemySpatialHash.clear();
        this.bullets = []; // Clear bullets too
        soundManager.playExplosion();
        this.screenShake = 50;
      }

      if (this.bossIntroTimer === 0 && this.pendingBoss && this.bossSpawnLocation) {
        // Spawn the boss now
        this.bosses.push(this.pendingBoss);
        this.pendingBoss = null;
        this.bossSpawnLocation = null;
        soundManager.setIntensity('BOSS');
      }

      // Still update camera to focus on player or spawn point
      const target = this.bossSpawnLocation || this.player.pos;
      const targetCam = target.sub(new Vector(this.canvas.width / 2, this.canvas.height / 2));
      this.camera = this.camera.add(targetCam.sub(this.camera).mult(0.1));
      return; // SKIP NORMAL UPDATE LOOP
    }

    this.globalPulse += 0.05;

    // Check for Level-Based Boss Spawns (Every 15 Levels)
    if (this.player.level > 0 && this.player.level % 15 === 0 && this.lastBossSpawnLevel !== this.player.level) {
      this.lastBossSpawnLevel = this.player.level;
      this.spawnTrueBoss();
      // Clear Arena Immediately
      this.enemies = [];
      this.enemySpatialHash.clear();
      this.bullets = [];
      this.screenShake = 20;
    }

    // Boss Status Check
    const isBossActive = this.bosses.length > 0;

    // Update Combo Decay - PAUSE IF BOSS IS ACTIVE
    if (this.combo > 0 && !isBossActive) {
      this.comboTimer--;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.texts.push(new FloatingText(this.player.pos.x, this.player.pos.y - 50, "COMBO LOST", '#ff0000', 20));
      }
    } else if (isBossActive && this.combo > 0) {
      // Keep timer full during boss
      this.comboTimer = this.comboMaxTimer;
    }

    // WAVE LOGIC
    // Blocks progress if True Boss is active (isBossActive) OR if Wave Chief is active (waveEventActive)
    if (!isBossActive) {
      if (this.waveTimer < this.WAVE_DURATION) {
        this.waveTimer++;
      } else {
        // Wave Limit Reached - Check for Chief
        if (!this.waveEventActive) {
          // Wave Chief Spawn
          this.spawnWaveChief();
          this.waveEventActive = true;
          this.callbacks.onBossSpawn(`ELITE HOSTILE DETECTED`);
          soundManager.playBossSpawn();
        } else if (this.chiefs.length === 0) {
          // Phase 2: Chief Defeated, Next Wave
          this.wave++;
          this.waveTimer = 0;
          this.waveEventActive = false;
          this.texts.push(new FloatingText(this.player.pos.x, this.player.pos.y - 100, `WAVE ${this.wave} START`, '#00ff9d', 30));
        }
      }
    }

    if (this.timeWarpTimer > 0) this.timeWarpTimer--;
    if (this.levelUpFlash > 0) this.levelUpFlash -= 0.05;

    // Optimization: Cap particles
    if (this.particles.length > 150) {
      this.particles.splice(0, this.particles.length - 150);
    }

    // Audio Intensity Update
    if (this.bosses.length > 0 || this.waveEventActive) {
      soundManager.setIntensity('BOSS');
    } else if (this.enemies.length > 40) {
      soundManager.setIntensity('ACTION');
    } else {
      soundManager.setIntensity('NORMAL');
    }

    // 0. Rebuild Spatial Hash (OPTIMIZATION MOVED HERE)
    this.enemySpatialHash.clear();
    for (const e of this.enemies) {
      this.enemySpatialHash.insert(e);
    }

    // 1. Core Updates
    const worldMouse = this.input.mouse.add(this.camera);
    const rawMouse = this.input.mouse;
    this.input.mouse = worldMouse;

    const wasDashing = this.player.dashCooldown > 0;
    // Pass enemies for homing targeting
    const newBullets = this.player.update(this.input, this.enemies);

    if (!wasDashing && this.player.dashCooldown > 0) {
      this.particles.push(new Particle(this.player.pos.x, this.player.pos.y, '#00ff9d', 0, 80, 'ring'));
      for (let i = 0; i < 8; i++) {
        this.particles.push(new Particle(this.player.pos.x, this.player.pos.y, '#00ff9d', 5, 3, 'spark'));
      }
      this.screenShake = 5;
    }

    if (newBullets.length > 0) {
      let aimDir = this.input.mouse.sub(this.player.pos).norm();
      for (let i = 0; i < 3; i++) {
        this.particles.push(new Particle(this.player.pos.x + aimDir.x * 20, this.player.pos.y + aimDir.y * 20, COLORS.BULLET, 2, 2, 'spark'));
      }
      this.bullets.push(...newBullets);
    }

    this.input.mouse = rawMouse;

    const allBossTargets = [...this.bosses, ...this.chiefs];

    this.allies.forEach(ally => {
      ally.syncStats(this.player);
      const allyBullet = ally.update(this.player, this.enemies.concat(allBossTargets as any));
      if (allyBullet) this.bullets.push(allyBullet);
    });

    // Camera follow
    const targetCam = this.player.pos.sub(new Vector(this.canvas.width / 2, this.canvas.height / 2));
    this.camera = this.camera.add(targetCam.sub(this.camera).mult(0.1));
    this.camera.x = Math.max(0, Math.min(this.camera.x, WORLD_SIZE - this.canvas.width));
    this.camera.y = Math.max(0, Math.min(this.camera.y, WORLD_SIZE - this.canvas.height));

    if (this.screenShake > 0) this.screenShake *= CONSTANTS.SCREEN_SHAKE_DECAY;
    if (this.screenShake < 0.5) this.screenShake = 0;

    // ACTIVE POWER ACTIVATION
    if (this.input.spacePressed && this.player.skillCooldown <= 0 && this.player.activeSkills.length > 0) {
      this.triggerActiveSkill();
    }

    // PLASMA AURA BUFF
    if (this.player.hasPlasmaAura) {
      // Hit Enemies
      this.enemies.forEach(e => {
        if (e.pos.dist(this.player.pos) < 150) {
          e.hp -= 1.0;
          if (Math.random() < 0.1) {
            this.particles.push(new Particle(e.pos.x, e.pos.y, '#ff00ff', 2, 2, 'spark'));
          }
        }
      });
      // Hit Bosses
      allBossTargets.forEach(b => {
        if (b.pos.dist(this.player.pos) < 150 + b.size) {
          b.hp -= 1.0;
          b.hitFlash = 3; // Trigger flash
          if (Math.random() < 0.1) {
            this.particles.push(new Particle(b.pos.x, b.pos.y, '#ff00ff', 2, 2, 'spark'));
          }
        }
      });
    }

    // UPDATE AREA EFFECTS (Black Holes)
    for (let i = this.areaEffects.length - 1; i >= 0; i--) {
      const ae = this.areaEffects[i];
      ae.update(this.enemies, allBossTargets as any, this.particles);
      if (ae.life <= 0) this.areaEffects.splice(i, 1);
    }

    // ALLY SPAWN LOGIC
    const intense = this.enemies.length > 80 || this.bosses.length > 0;
    const hasSpecialAlly = this.azBox || this.warBlade || this.virtuaCop || this.bagalis;

    if (intense && !hasSpecialAlly) {
      // AZBoxThunder (Extremely Rare)
      if (Math.random() < 0.000025) {
        this.azBox = new AZBoxThunder(this.player.pos);
        this.callbacks.onBossSpawn("SUPPORT INBOUND: AZBoxThunder");
      }
      // WarBlade (Extremely Rare)
      else if (Math.random() < 0.000025) {
        this.warBlade = new WarBlade(this.player.pos);
        this.callbacks.onBossSpawn("ULTIMATE ALLY: WarBlade");
      }
      // VirtuaCop (Rare)
      else if (Math.random() < 0.00005) {
        this.virtuaCop = new VirtuaCop(this.player.pos);
        this.callbacks.onBossSpawn("BACKUP: VirtuaCop");
      }
      // Bagalis (Rare)
      else if (Math.random() < 0.00005) {
        this.bagalis = new Bagalis(this.player.pos);
        this.callbacks.onBossSpawn("HEAVY SUPPORT: Bagalis");
      }
    }

    if (this.azBox) {
      this.azBox.update(this.enemies, allBossTargets as any, this.bullets, this.particles);
      if (this.azBox.finished) this.azBox = null;
    }
    if (this.warBlade) {
      this.warBlade.update(this.enemies, allBossTargets as any, this.particles);
      if (this.warBlade.finished) this.warBlade = null;
    }
    if (this.virtuaCop) {
      const bullet = this.virtuaCop.update(this.enemies, allBossTargets as any, this.player.pos);
      if (bullet) this.bullets.push(bullet);
      if (this.virtuaCop.finished) this.virtuaCop = null;
    }
    if (this.bagalis) {
      this.bagalis.update(this.enemies, allBossTargets as any, this.particles);
      if (this.bagalis.finished) this.bagalis = null;
    }

    // 2. Spawners
    // UPDATED LOGIC: Spawning continues if an Elite (Chief) is active.
    // Spawning only stops if True Boss is active, or if wave timer ends AND no Elite is active.
    const canSpawn = !isBossActive && (this.waveTimer < this.WAVE_DURATION || this.waveEventActive);

    if (canSpawn) {
      const spawnChance = 0.005 + (0.015 * Math.log(this.wave * 2));
      const effectiveSpawnChance = Math.min(spawnChance, 0.15);
      if (Math.random() < effectiveSpawnChance) {
        this.spawnEnemy();
      }
    }

    // 3. Entity Updates & Collisions
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(this.enemies); // Pass enemies for retargeting

      if (b.life <= 0 ||
        b.pos.x < 0 || b.pos.x > WORLD_SIZE ||
        b.pos.y < 0 || b.pos.y > WORLD_SIZE) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.isEnemy) {
        if (this.player.pos.dist(b.pos) < 10 + b.radius) {
          if (this.player.invulnerable <= 0) {
            this.player.takeDamage(b.damage);
            this.texts.push(new FloatingText(this.player.pos.x, this.player.pos.y, `-${Math.round(b.damage)}`, '#ff0000', 16));
            this.screenShake = 10;
            this.player.invulnerable = 15;
            this.bullets.splice(i, 1);
            soundManager.playEnemyHit();

            if (this.combo > 0) {
              this.combo = 0;
              this.texts.push(new FloatingText(this.player.pos.x, this.player.pos.y - 30, "COMBO BROKEN", '#ff0000', 24));
            }

            if (this.player.hp <= 0) {
              soundManager.stopBGM();
              soundManager.playGameOver();
              this.callbacks.onGameOver(this.score, this.maxCombo);
              this.isRunning = false;
            }
          }
        }
        continue;
      }

      // OPTIMIZED COLLISION - Regular Enemies
      const nearbyEnemies = this.enemySpatialHash.query(b.pos);
      let bulletDestroyed = false;

      for (const e of nearbyEnemies) {
        const distSq = (b.pos.x - e.pos.x) ** 2 + (b.pos.y - e.pos.y) ** 2;
        const radSum = e.size + b.radius;

        if (distSq < radSum * radSum) {
          if (!b.hasHit(e)) {
            e.hp -= b.damage;
            if (b.isCrit) {
              this.hitStopTimer = 4; // Congela por 4 frames em Críticos
            }
            if (e.hp <= 0 && e.size > 30) { // Matou inimigo grande
              this.hitStopTimer = 8; // Congela mais tempo na morte
            }
            // Lógica da Sinergia: Blood Cooling (Vampirismo)
            if (e.hp <= 0 && b.isCrit && this.player.vampirism) {
              // Cura 1 HP, respeitando o máximo
              if (this.player.hp < this.player.maxHp) {
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
                // Efeito visual (Texto flutuante verde)
                this.texts.push(new FloatingText(this.player.pos.x, this.player.pos.y - 20, "+1 HP", '#00ff00', 16));
              }
            }
            b.registerHit(e);
            b.piercing--;
            soundManager.playEnemyHit();

            if (b.isCrit) {
              this.particles.push(new Particle(b.pos.x, b.pos.y, '#ffff00', 3, 3, 'spark'));
            }

            if (b.knockback > 0) {
              const pushDir = e.pos.sub(b.pos).norm().mult(b.knockback);
              e.pos = e.pos.add(pushDir);
            }

            const txtColor = b.isCrit ? COLORS.TEXT_CRIT : COLORS.TEXT_DAMAGE;
            const txtSize = b.isCrit ? 20 : 12;
            this.texts.push(new FloatingText(e.pos.x, e.pos.y, Math.floor(b.damage).toString(), txtColor, txtSize));

            for (let k = 0; k < 3; k++) {
              this.particles.push(new Particle(e.pos.x, e.pos.y, e.color, 4, 3, 'spark'));
            }

            if (b.blastRadius > 0) {
              this.triggerExplosion(b.pos, b.blastRadius, b.damage * 0.5, b.isCrit);
            }

            if (b.bounces > 0) {
              b.bounces--;
              let bestTarget = null;
              let bestDist = 600;
              for (const potential of this.enemies) {
                if (potential !== e && potential.hp > 0 && !b.hasHit(potential)) {
                  const d = b.pos.dist(potential.pos);
                  if (d < bestDist) {
                    bestDist = d;
                    bestTarget = potential;
                  }
                }
              }

              if (bestTarget) {
                const newDir = bestTarget.pos.sub(b.pos).norm();
                b.vel = newDir.mult(b.vel.mag());
              } else {
                const angle = Math.random() * Math.PI * 2;
                b.vel = Vector.fromAngle(angle).mult(b.vel.mag());
              }
              this.particles.push(new Particle(b.pos.x, b.pos.y, '#ffffff', 2, 5, 'spark'));
              if (b.piercing <= 0) b.piercing = 1;
            }
            else if (b.piercing <= 0) {
              this.bullets.splice(i, 1);
              bulletDestroyed = true;
              break;
            }
          }
        }
      }

      if (bulletDestroyed) continue;

      // Boss & WaveChief Collisions
      for (const boss of allBossTargets) {
        if (b.pos.dist(boss.pos) < boss.size + b.radius) {
          if (!b.hasHit(boss as any)) {
            // MONOLITH SHIELD LOGIC
            // Em src/core/Game.ts -> update()

            // MONOLITH SHIELD LOGIC REBALANCEADA
            let effectiveDmg = b.damage;
            if (boss instanceof Monolith) {
              const minions = this.enemies.filter(e => e.type === 'mini_monolith');

              if (minions.length > 0) {
                // ANTES: effectiveDmg *= 0.1 (90% de redução - Muito Injusto)
                // AGORA: Redução dinâmica baseada na quantidade, com teto de 60%

                // Cada minion dá 10% de resistência, até o máximo de 60% (sobra 40% de dano)
                const reduction = Math.min(0.6, minions.length * 0.1);
                effectiveDmg *= (1 - reduction);

                // Feedback visual: Se o dano foi muito reduzido, mostramos cinza
                if (reduction >= 0.5) {
                  // Hack visual: força o texto de dano a ser cinza depois
                  b.isCrit = false;
                }
              }
            }
            if ('damageReduction' in boss && (boss as any).damageReduction > 0) {
              const reduction = (boss as any).damageReduction; // ex: 0.6
              effectiveDmg *= (1 - reduction); // Aplica redução

              // Efeito visual de "Ricochete" / Defesa
              if (Math.random() < 0.3) {
                this.particles.push(new Particle(boss.pos.x, boss.pos.y, '#ffffff', 5, 2, 'ring')); // Anel de defesa
                // Som metálico seria bom aqui
              }
            }

            boss.hp -= effectiveDmg;
            // ... continue com o código original (boss.hitFlash = 5, etc)

            boss.hp -= effectiveDmg;
            boss.hitFlash = 5;
            b.registerHit(boss as any);
            b.piercing--;
            soundManager.playEnemyHit();
            this.texts.push(new FloatingText(boss.pos.x, boss.pos.y, Math.floor(effectiveDmg).toString(), b.isCrit ? COLORS.TEXT_CRIT : COLORS.TEXT_DAMAGE, 14));

            if (Math.random() < 0.5) this.particles.push(new Particle(boss.pos.x, boss.pos.y, '#ffffff', 4, 3, 'spark'));

            if (b.blastRadius > 0) {
              this.triggerExplosion(b.pos, b.blastRadius, effectiveDmg * 0.5, b.isCrit);
            }

            if (b.piercing <= 0) {
              this.bullets.splice(i, 1);
              bulletDestroyed = true;
              break;
            }
          }
        }
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update();
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.update();
      if (t.life <= 0) this.texts.splice(i, 1);
    }

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      const active = o.update(this.player);

      if (!active) {
        this.orbs.splice(i, 1);
        continue;
      }

      if (o.pos.dist(this.player.pos) < 40 + o.radius) {
        const color = o.type === 'xp' ? COLORS.ORB_XP : COLORS.ORB_HEALTH;
        this.particles.push(new Particle(o.pos.x, o.pos.y, color, 3, 2));

        if (o.type === 'xp') {
          this.player.gainXp(o.value);
          if (this.player.checkLevelUp()) {
            this.triggerLevelUp();
            this.levelUpFlash = 0.5;
            this.particles.push(new Particle(this.player.pos.x, this.player.pos.y, '#fff', 0, 150, 'ring'));
            soundManager.playPowerUp();
          }
        } else {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + o.value);
          soundManager.playPowerUp();
          this.texts.push(new FloatingText(this.player.pos.x, this.player.pos.y, "+HP", '#00ff00', 14));
        }
        this.orbs.splice(i, 1);
      }
    }

    // Enemy Updates
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e.hp <= 0) {
        this.killEnemy(e, i);
        continue;
      }

      if (e.pendingSpawns.length > 0) {
        if (this.enemies.length < 500) {
          this.pendingEnemies.push(...e.pendingSpawns);
        }
        e.pendingSpawns = [];
      }

      let speedMult = 1.0;
      if (this.timeWarpTimer > 0) speedMult = 0.15;

      const oldSpeed = e.speed;
      e.speed *= speedMult;

      const nearby = this.enemySpatialHash.query(e.pos);
      const enemyBullet = e.update(this.player, nearby);

      e.speed = oldSpeed; // Restore

      if (enemyBullet) {
        this.bullets.push(enemyBullet);
      }

      if (this.player.pos.dist(e.pos) < e.size + 10) {
        if (this.player.isDashing && this.player.dashDamage > 0) {
          e.hp -= this.player.dashDamage;
          this.particles.push(new Particle(e.pos.x, e.pos.y, '#00ffff', 4, 4, 'spark'));
          soundManager.playEnemyHit();
          this.texts.push(new FloatingText(e.pos.x, e.pos.y, this.player.dashDamage.toString(), '#00ffff', 20));
          this.incrementCombo(1);
        }
        else if (this.player.invulnerable <= 0) {
          this.player.takeDamage(e.damage);
          this.screenShake = 15;
          this.player.invulnerable = 20;
          soundManager.playEnemyHit();
          this.texts.push(new FloatingText(this.player.pos.x, this.player.pos.y, `-${Math.round(e.damage)}`, '#ff0000', 16));

          if (e.type === 'electric_speeder') {
            this.player.applyStun(30);
            this.texts.push(new FloatingText(this.player.pos.x, this.player.pos.y - 40, "STUN!", '#ffff00', 20));
            // KAMIKAZE FIX: Speeder destroys itself on impact to prevent infinite stun loop
            e.hp = 0;
            for (let k = 0; k < 10; k++) this.particles.push(new Particle(e.pos.x, e.pos.y, '#ffff00', 5, 5, 'spark'));
          }

          if (this.combo > 0) {
            this.combo = 0;
            this.texts.push(new FloatingText(this.player.pos.x, this.player.pos.y - 30, "COMBO BROKEN", '#ff0000', 24));
          }

          if (this.player.hp <= 0) {
            soundManager.stopBGM();
            soundManager.playGameOver();
            this.callbacks.onGameOver(this.score, this.maxCombo);
            this.isRunning = false;
          }
        }
      }
    }

    // Pending Enemy Additions
    if (this.pendingEnemies.length > 0) {
      this.enemies.push(...this.pendingEnemies);
      this.pendingEnemies = [];
    }

    // Handle Wave Chiefs and True Bosses
    this.updateBossList(this.chiefs);
    this.updateBossList(this.bosses);
  }

  updateBossList(list: IBoss[]) {
    for (let i = list.length - 1; i >= 0; i--) {
      const boss = list[i];
      if (boss.hp <= 0) {
        list.splice(i, 1);
        // ECONOMY FIX: Use boss specific XP value
        this.score += boss.xpValue;

        this.screenShake = 60;
        soundManager.playExplosion();
        this.particles.push(new Particle(boss.pos.x, boss.pos.y, '#fff', 0, 300, 'ring'));
        for (let k = 0; k < 50; k++) this.particles.push(new Particle(boss.pos.x, boss.pos.y, '#ff0055', 8 + Math.random() * 8, 5, 'spark'));

        const lootCount = 5 + Math.min(5, Math.floor(this.player.level / 5)); // 5 to 10 orbs
        const orbValue = 25 + (this.player.level * 2); // Moderate XP scaling
        const bossBullets = boss.update(this.player, this.enemies);

        if (boss instanceof WaveChief && boss.type === 'speeder') {
          // Se estiver em alta velocidade (Dash)
          if (boss.vel.mag() > 15) {
            const backward = boss.vel.norm().mult(-1);
            // Cria um fluxo contínuo na traseira
            for (let k = 0; k < 3; k++) { // 3 partículas por frame para ficar denso
              // Espalhamento menor (cone mais fechado)
              const spread = new Vector((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
              // Posição de saída: atrás do boss
              const pPos = boss.pos.add(backward.mult(boss.size / 2)).add(spread);

              // Partículas mais rápidas e que duram um pouco mais para fazer rastro
              const pVel = backward.mult(5 + Math.random() * 5);

              // Cor varia entre laranja e amarelo
              const pColor = Math.random() > 0.5 ? '#ff9900' : '#ffff55';
              this.particles.push(new Particle(pPos.x, pPos.y, pColor, 5, 4, 'spark', pVel));
            }
          }
        }

        for (let k = 0; k < lootCount; k++) {
          this.orbs.push(new Orb(boss.pos.x + (Math.random() - 0.5) * 150, boss.pos.y + (Math.random() - 0.5) * 150, orbValue, 'xp'));
        }

        this.orbs.push(new Orb(boss.pos.x, boss.pos.y, 200, 'health'));

        continue;
      }

      let speedMult = 1.0;
      if (this.timeWarpTimer > 0) speedMult = 0.15;

      const originalPos = boss.pos.copy();
      const bossBullets = boss.update(this.player, this.enemies);

      if (speedMult < 1.0) {
        boss.pos = originalPos.add(boss.pos.sub(originalPos).mult(speedMult));
      }

      if (bossBullets.length > 0) {
        this.bullets.push(...bossBullets);
      }

      if (boss.pendingSpawns.length > 0) {
        this.pendingEnemies.push(...boss.pendingSpawns);
        boss.pendingSpawns = [];
      }

      if (boss.pendingAreaEffects.length > 0) {
        this.areaEffects.push(...boss.pendingAreaEffects);
        boss.pendingAreaEffects = [];
      }

      if (this.player.pos.dist(boss.pos) < boss.size + 10) {
        if (this.player.isDashing && this.player.dashDamage > 0) {
          boss.hp -= this.player.dashDamage;
          boss.hitFlash = 5;
          this.particles.push(new Particle(boss.pos.x, boss.pos.y, '#00ffff', 4, 4, 'spark'));
          soundManager.playEnemyHit();
          this.texts.push(new FloatingText(boss.pos.x, boss.pos.y, this.player.dashDamage.toString(), '#00ffff', 20));
        }
        else if (this.player.invulnerable <= 0) {
          this.player.takeDamage(boss.contactDamage);
          this.screenShake = 20;
          this.player.invulnerable = 40;

          if (this.combo > 0) {
            this.combo = 0;
            this.texts.push(new FloatingText(this.player.pos.x, this.player.pos.y - 30, "COMBO BROKEN", '#ff0000', 24));
          }

          if (this.player.hp <= 0) {
            soundManager.stopBGM();
            soundManager.playGameOver();
            this.callbacks.onGameOver(this.score, this.maxCombo);
            this.isRunning = false;
          }
        }
      }
    }
  }

  triggerExplosion(pos: Vector, radius: number, damage: number, isCrit: boolean) {
    this.particles.push(new Particle(pos.x, pos.y, isCrit ? '#ffff00' : '#ff4400', 0, radius * 2, 'ring'));
    for (let i = 0; i < 10; i++) {
      this.particles.push(new Particle(pos.x, pos.y, '#ff8800', 5 + Math.random() * 5, 4, 'spark'));
    }
    soundManager.playExplosion();

    for (const e of this.enemies) {
      if (e.pos.dist(pos) < radius + e.size) {
        e.hp -= damage;
        this.texts.push(new FloatingText(e.pos.x, e.pos.y, Math.round(damage).toString(), '#ffaa00', 14));
      }
    }

    // Damage Bosses/Chiefs too
    [...this.bosses, ...this.chiefs].forEach(b => {
      if (b.pos.dist(pos) < radius + b.size) {
        b.hp -= damage;
        this.texts.push(new FloatingText(b.pos.x, b.pos.y, Math.round(damage).toString(), '#ffaa00', 14));
      }
    });
  }

  killEnemy(e: Enemy, index: number) {
    this.enemies.splice(index, 1);
    this.score += e.xpValue;

    // Removed immediate XP gain - now relies on Orbs
    // this.player.gainXp(e.xpValue); 

    // ORB DROP FIX: 100% Drop Rate + Full Value
    this.orbs.push(new Orb(e.pos.x, e.pos.y, e.xpValue, 'xp'));

    const hasBlackHole = this.player.activeSkills.includes('black_hole');
    if (Math.random() < 0.05 + (hasBlackHole ? 0.05 : 0)) {
      this.orbs.push(new Orb(e.pos.x, e.pos.y, 20, 'health'));
    }

    this.incrementCombo(1);

    const parts = Math.min(10, e.size / 2);
    for (let k = 0; k < parts; k++) {
      this.particles.push(new Particle(e.pos.x, e.pos.y, e.color, 2 + Math.random() * 3, 3));
    }
    this.particles.push(new Particle(e.pos.x, e.pos.y, e.color, 0, e.size * 1.5, 'ring'));
  }

  triggerLevelUp() {
    this.isPaused = true;
    soundManager.setPauseState(true);
    let options: (Upgrade | Power)[] = [];

    if (this.player.level % 10 === 0) {
      const availablePowers = POWERS.filter(p => {
        if (p.type === 'active') return !this.player.activeSkills.includes(p.id);
        return true;
      });
      options = availablePowers.sort(() => 0.5 - Math.random()).slice(0, 3);
      if (options.length < 3) {
        const fillers = getWeightedUpgrades(3 - options.length, this.player);
        options.push(...fillers);
      }
    } else {
      options = getWeightedUpgrades(3, this.player);
    }

    this.callbacks.onLevelUp(options);
  }

  incrementCombo(amount: number) {
    this.combo += amount;
    this.comboTimer = this.comboMaxTimer;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }
    if (this.combo % 10 === 0) {
      soundManager.playCombo(this.combo);
      this.texts.push(new FloatingText(this.player.pos.x, this.player.pos.y - 40, `${this.combo}x COMBO!`, '#ffff00', 24));
      this.screenShake = 5;
    }
  }

  draw() {
    this.ctx.fillStyle = COLORS.BACKGROUND;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();

    if (this.screenShake > 0) {
      const dx = (Math.random() - 0.5) * this.screenShake;
      const dy = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(-this.camera.x + dx, -this.camera.y + dy);
    } else {
      this.ctx.translate(-this.camera.x, -this.camera.y);
    }

    const startX = Math.floor(this.camera.x / TILE_SIZE) * TILE_SIZE;
    const startY = Math.floor(this.camera.y / TILE_SIZE) * TILE_SIZE;
    const endX = startX + this.canvas.width + TILE_SIZE;
    const endY = startY + this.canvas.height + TILE_SIZE;

    this.ctx.strokeStyle = COLORS.GRID;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let x = startX; x <= endX; x += TILE_SIZE) {
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += TILE_SIZE) {
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
    }
    this.ctx.stroke();

    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 5;
    this.ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);

    this.areaEffects.forEach(ae => ae.draw(this.ctx));
    this.orbs.forEach(o => o.draw(this.ctx));
    this.particles.forEach(p => p.draw(this.ctx));

    if (this.azBox) this.azBox.draw(this.ctx, this.enemies, [...this.bosses, ...this.chiefs] as any);
    if (this.warBlade) this.warBlade.draw(this.ctx);
    if (this.virtuaCop) this.virtuaCop.draw(this.ctx);
    if (this.bagalis) this.bagalis.draw(this.ctx);
    this.allies.forEach(a => a.draw(this.ctx));

    this.enemies.forEach(e => e.draw(this.ctx));

    // Draw Chiefs
    this.chiefs.forEach(c => c.draw(this.ctx));
    // Draw True Bosses
    this.bosses.forEach(b => b.draw(this.ctx));

    this.player.draw(this.ctx);
    this.bullets.forEach(b => b.draw(this.ctx));
    this.texts.forEach(t => t.draw(this.ctx));

    if (this.bossIntroTimer > 0) {
      if (this.bossIntroTimer > this.bossIntroTotalTime - 10) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.globalAlpha = (this.bossIntroTimer - (this.bossIntroTotalTime - 10)) / 10;
        this.ctx.fillRect(this.camera.x, this.camera.y, this.canvas.width, this.canvas.height);
        this.ctx.globalAlpha = 1;
      } else {
        if (this.bossSpawnLocation) {
          this.ctx.strokeStyle = '#ff0000';
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([20, 20]);
          this.ctx.beginPath();
          this.ctx.moveTo(this.player.pos.x, this.player.pos.y);
          this.ctx.lineTo(this.bossSpawnLocation.x, this.bossSpawnLocation.y);
          this.ctx.stroke();
          this.ctx.setLineDash([]);

          this.ctx.strokeStyle = '#ff0000';
          this.ctx.lineWidth = 4;
          this.ctx.beginPath();
          const r = 100 - (this.bossIntroTimer % 20) * 5;
          this.ctx.arc(this.bossSpawnLocation.x, this.bossSpawnLocation.y, Math.max(0, r), 0, Math.PI * 2);
          this.ctx.stroke();
        }
      }
    }

    if (this.timeWarpTimer > 0) {
      this.ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
      this.ctx.fillRect(this.camera.x, this.camera.y, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      for (let i = 0; i < this.canvas.height; i += 4) {
        this.ctx.fillRect(this.camera.x, this.camera.y + i, this.canvas.width, 1);
      }
    }

    if (this.levelUpFlash > 0) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.globalAlpha = this.levelUpFlash;
      this.ctx.fillRect(this.camera.x, this.camera.y, this.canvas.width, this.canvas.height);
      this.ctx.globalAlpha = 1;
    }

    // ... (logo após o bloco do levelUpFlash)
    if (this.levelUpFlash > 0) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.globalAlpha = this.levelUpFlash;
      this.ctx.fillRect(this.camera.x, this.camera.y, this.canvas.width, this.canvas.height);
      this.ctx.globalAlpha = 1;
    }

    this.ctx.restore(); // <--- O restore() original do draw()

    this.drawBossOffScreenIndicators(this.ctx);

    this.ctx.restore();

    this.callbacks.onUpdateHUD({
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      score: this.score,
      level: this.player.level,
      xp: this.player.xp,
      xpMax: this.player.xpToNextLevel,

      activeSkills: this.player.activeSkills,
      passivePowers: this.player.passivePowers,

      dashCooldown: this.player.dashCooldown,
      dashMaxCooldown: (isNaN(this.player.dashMaxCooldown) || this.player.dashMaxCooldown <= 0)
        ? 60
        : (this.player.dashMaxCooldown * this.player.dashCooldownMult),

      combo: this.combo,
      comboTimer: this.comboTimer,
      maxComboTimer: this.comboMaxTimer,
      wave: this.wave,
      bossActive: this.bosses.length > 0
    });
  }

  spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    // Spawn just outside camera view (radius based on screen diagonal)
    const diag = Math.sqrt(this.canvas.width * this.canvas.width + this.canvas.height * this.canvas.height);
    const r = (diag / 2) + 100;

    // Spawn relative to player (center of camera focus)
    const spawnPos = this.player.pos.add(Vector.fromAngle(angle).mult(r));

    // Clamp to world
    spawnPos.x = Math.max(50, Math.min(WORLD_SIZE - 50, spawnPos.x));
    spawnPos.y = Math.max(50, Math.min(WORLD_SIZE - 50, spawnPos.y));

    // Determine Type based on Wave
    let availableTypes: EnemyType[] = ['grunt'];
    if (this.wave > 2) availableTypes.push('speeder');
    if (this.wave > 4) availableTypes.push('tank');
    if (this.wave > 6) availableTypes.push('seeker', 'swarmer');
    if (this.wave > 8) availableTypes.push('brute', 'exploder');
    if (this.wave > 10) availableTypes.push('sniper', 'waver', 'turret');
    if (this.wave > 12) availableTypes.push('teleporter', 'orbit');
    if (this.wave > 15) availableTypes.push('armored', 'ghost', 'fractal');
    if (this.wave > 18) availableTypes.push('mender', 'lancer', 'vortex');
    if (this.wave > 20) availableTypes.push('trailblazer', 'layer', 'beamer');
    if (this.wave > 25) availableTypes.push('aegis', 'glitch', 'carrier');

    // Weight towards newer enemies slightly? Or just random.
    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];

    // Difficulty Scaling
    let mult = 1.0 + (this.wave * 0.15) + this.enemyBuffStrength;

    this.enemies.push(new Enemy(spawnPos.x, spawnPos.y, type, mult));
  }

  // Em src/core/Game.ts

  spawnWaveChief() {
    let types: EnemyType[] = [];

    // REGRAS DE SPAWN

    // 1. O Grunt (Cubo) é o tutorial. Aparece apenas nas waves 1, 2 e 3.
    if (this.wave <= 3) {
      types.push('grunt');
    }

    // 2. Speeder reativado a partir da Wave 3
    if (this.wave >= 3) {
      types.push('speeder');
    }

    // 3. Outros Elites (Progressão Normal)
    if (this.wave > 10) types.push('tank');
    if (this.wave > 15) types.push('seeker', 'sniper');
    if (this.wave > 20) types.push('brute', 'aegis');

    // Fallback de segurança: Se por algum motivo a lista estiver vazia (ex: bug na wave 4 se não tiver speeder),
    // garantimos que o speeder ou grunt apareça.
    if (types.length === 0) {
      types.push('speeder');
    }

    const type = types[Math.floor(Math.random() * types.length)];

    // Lógica de posição (mantida igual)
    const angle = Math.random() * Math.PI * 2;
    const dist = 500;
    const spawnLoc = this.player.pos.add(Vector.fromAngle(angle).mult(dist));

    spawnLoc.x = Math.max(100, Math.min(WORLD_SIZE - 100, spawnLoc.x));
    spawnLoc.y = Math.max(100, Math.min(WORLD_SIZE - 100, spawnLoc.y));

    const chief = new WaveChief(spawnLoc.x, spawnLoc.y, this.player, this.wave, type);
    this.chiefs.push(chief);

    this.particles.push(new Particle(spawnLoc.x, spawnLoc.y, '#ff0000', 0, 150, 'ring'));
  }

  spawnTrueBoss() {
    this.bossIntroTimer = this.bossIntroTotalTime;

    const angle = Math.random() * Math.PI * 2;
    const dist = 600;
    this.bossSpawnLocation = this.player.pos.add(Vector.fromAngle(angle).mult(dist));
    this.bossSpawnLocation.x = Math.max(300, Math.min(WORLD_SIZE - 300, this.bossSpawnLocation.x));
    this.bossSpawnLocation.y = Math.max(300, Math.min(WORLD_SIZE - 300, this.bossSpawnLocation.y));

    if (Math.random() < 0.5) {
      this.pendingBoss = new Cursor(this.bossSpawnLocation.x, this.bossSpawnLocation.y, this.player.level);
      this.callbacks.onBossSpawn("WARNING: THE CURSOR");
    } else {
      this.pendingBoss = new Monolith(this.bossSpawnLocation.x, this.bossSpawnLocation.y, this.player.level);
      this.callbacks.onBossSpawn("WARNING: MONOLITH");
    }
  }

  triggerActiveSkill() {
    this.player.skillCooldown = this.player.skillMaxCooldown;

    this.player.activeSkills.forEach(skill => {
      if (skill === 'shockwave' || skill === 'logic_bomb') {
        const blastRadius = 500;
        const damage = 100 + (this.player.damage * 3);

        this.triggerExplosion(this.player.pos, blastRadius, damage, true);

        this.particles.push(new Particle(
          this.player.pos.x,
          this.player.pos.y,
          '#00ffff',
          0,
          blastRadius, // Tamanho final do anel
          'shockwave'
        ));

        this.screenShake = 20;
      }
      else if (skill === 'overload') {
        this.player.overloadTimer = 300;
        soundManager.playPowerUp();
      }
      else if (skill === 'time_warp') {
        this.timeWarpTimer = 360;
        soundManager.playPowerUp();
      }
      else if (skill === 'missile_swarm') {
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2;
          // Misseis teleguiados
          const b = new Bullet(
            this.player.pos,
            Vector.fromAngle(angle).mult(10),
            this.player.damage * 2, 6, 240, 1, false, undefined, true
          );
          b.homing = true;
          this.bullets.push(b);
        }
        soundManager.playShoot();
      }
      else if (skill === 'black_hole') {
        // Reativando caso queira testar, ou mantenha comentado se preferir
        this.areaEffects.push(new AreaEffect(this.input.mouse.x, this.input.mouse.y, 'black_hole'));
        soundManager.playPowerUp();
      }
    });
  }

  drawBossOffScreenIndicators(ctx: CanvasRenderingContext2D) {
    const allBosses = [...this.bosses, ...this.chiefs];
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const margin = 30; // Distância da borda da tela

    for (const boss of allBosses) {
      // Converte posição do mundo para posição na tela
      const screenX = boss.pos.x - this.camera.x;
      const screenY = boss.pos.y - this.camera.y;

      // Verifica se o Boss já está visível (com uma margem de segurança)
      // Se estiver na tela, não desenha a seta.
      if (screenX >= -boss.size && screenX <= this.canvas.width + boss.size &&
        screenY >= -boss.size && screenY <= this.canvas.height + boss.size) {
        continue;
      }

      // Calcula o ângulo entre o centro da tela e o Boss
      const dx = screenX - cx;
      const dy = screenY - cy;
      const angle = Math.atan2(dy, dx);

      // Matemática para "prender" a seta na borda da tela (Clamping)
      // Descobre qual parede (H ou V) o raio atinge primeiro
      const absCos = Math.abs(Math.cos(angle));
      const absSin = Math.abs(Math.sin(angle));

      const tX = (cx - margin) / absCos;
      const tY = (cy - margin) / absSin;

      // Usa a menor distância para garantir que fique dentro da tela
      const t = Math.min(tX, tY);

      const arrowX = cx + t * Math.cos(angle);
      const arrowY = cy + t * Math.sin(angle);

      // Desenha a Seta
      ctx.save();
      ctx.translate(arrowX, arrowY);
      ctx.rotate(angle);

      // Cores baseadas no tipo de inimigo para ajudar na identificação rápida
      let color = '#ff0055'; // Vermelho Padrão (True Bosses / Grunt)

      // Tenta identificar o tipo (se for WaveChief)
      if ('type' in boss) {
        const type = (boss as any).type;
        if (type === 'speeder') color = '#ff8800'; // Laranja
        if (type === 'tank') color = '#bd00ff';    // Roxo
        if (type === 'sniper') color = '#ffffff';  // Branco
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      // Triângulo simples estilo diep.io
      ctx.moveTo(10, 0);   // Ponta
      ctx.lineTo(-10, 10); // Base Esq
      ctx.lineTo(-10, -10);// Base Dir
      ctx.closePath();
      ctx.fill();

      // Borda preta para contraste
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    }
  }
}