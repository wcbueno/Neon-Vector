
import { Vector } from '../core/Vector';
import { COLORS, WORLD_SIZE } from '../utils/Constants';
import { Player } from './Player';
import { Bullet } from './Bullet';
import { Enemy, EnemyType } from './Enemy';
import { AreaEffect } from './AreaEffect';

// --- SHARED BOSS INTERFACE ---
export interface IBoss {
    pos: Vector;
    vel: Vector;
    hp: number;
    maxHp: number;
    name: string;
    size: number;
    contactDamage: number;
    hitFlash: number;
    xpValue: number;

    // Arrays for interactions
    pendingSpawns: Enemy[];
    pendingAreaEffects: AreaEffect[];
    pendingBossSpawns: IBoss[];

    update(player: Player, enemies: Enemy[]): Bullet[];
    draw(ctx: CanvasRenderingContext2D): void;
}

// --- WAVE CHIEF (Elite Enemy Reworked) ---

export type BossAffixType = 'vampiric' | 'reactive' | 'tether' | 'none';

type SpeederState = 'chase' | 'charge' | 'dash' | 'cooldown';

export class WaveChief implements IBoss {
    pos: Vector;
    vel: Vector;

    hp: number;
    maxHp: number;
    name: string;
    size: number;
    speed: number;
    contactDamage: number;
    xpValue: number;

    type: EnemyType;
    affixes: BossAffixType[];

    // AI State
    stateTimer: number;
    strafeTimer: number;
    rageMode: boolean = false;
    spawnAnimationTimer: number = 0;

    // Speeder Specifics
    speederState: SpeederState = 'chase';
    dashDir: Vector = new Vector(0, 0);
    public damageReduction: number = 0; // 0.0 a 1.0 (Exposto para o Game.ts)

    hitFlash: number = 0;

    pendingSpawns: Enemy[] = [];
    pendingAreaEffects: AreaEffect[] = [];
    pendingBossSpawns: IBoss[] = [];

    weaponTimer: number = 0;

    constructor(x: number, y: number, player: Player, wave: number, type: EnemyType) {
        this.pos = new Vector(x, y);
        this.vel = new Vector(0, 0);
        this.stateTimer = 0;
        this.strafeTimer = Math.random() * 100;
        this.spawnAnimationTimer = 60;
        this.type = type;

        this.affixes = BossGenerator.generateAffixes(wave);
        this.name = `ELITE ${type.toUpperCase()}`;

        // HP Scaling
        const baseHp = 800 + (player.level * 60);
        const rawDmg = 15 + (player.level * 0.5); // Dano base aumentado (já que é melee)
        const baseDmg = Math.min(40, rawDmg);

        this.xpValue = 120;

        let hpMult = 1.0;
        let speedBase = 2.0;
        let sizeBase = 40;

        switch (type) {
            case 'grunt': hpMult = 1.0; speedBase = 2.5; sizeBase = 45; break;
            case 'speeder': hpMult = 1.2; speedBase = 5.5; sizeBase = 40; break;
            case 'tank': hpMult = 4.0; speedBase = 1.0; sizeBase = 70; break;
            case 'seeker': hpMult = 1.2; speedBase = 2.5; sizeBase = 50; break;
            case 'sniper': hpMult = 0.9; speedBase = 1.8; sizeBase = 40; break;
            case 'turret': hpMult = 2.5; speedBase = 0; sizeBase = 60; break;
            default: hpMult = 1.5; speedBase = 2.0; sizeBase = 50;
        }

        this.maxHp = baseHp * hpMult;
        this.hp = this.maxHp;
        this.speed = speedBase;
        this.size = sizeBase;
        this.contactDamage = baseDmg;
    }

    update(player: Player, enemies: Enemy[]): Bullet[] {
        if (this.spawnAnimationTimer > 0) this.spawnAnimationTimer--;
        if (this.hitFlash > 0) this.hitFlash--;

        this.stateTimer++;
        this.weaponTimer++;

        const vecToPlayer = player.pos.sub(this.pos).norm();
        const distToPlayer = this.pos.dist(player.pos);

        // Rage Mode
        if (this.hp < this.maxHp * 0.5 && !this.rageMode) {
            this.rageMode = true;
        }

        const bullets: Bullet[] = [];
        let effectiveSpeed = this.speed;
        if (this.affixes.includes('tether')) effectiveSpeed *= 0.8;

        // Reinicia redução de dano a cada frame (o estado define se aumenta)
        this.damageReduction = 0;

        // --- LÓGICA DE MOVIMENTO ---

        if (this.spawnAnimationTimer > 0) {
            this.vel = new Vector(0, 0);
        }
        // --- LÓGICA NOVA DO SPEEDER ---
        else if (this.type === 'speeder') {
            // Máquina de Estados do Speeder

            // 1. CHASE: Persegue o player para entrar em alcance
            if (this.speederState === 'chase') {
                this.vel = vecToPlayer.mult(effectiveSpeed);

                // Se estiver perto (mas não colado) e o cooldown do dash acabou
                // Intervalo: A cada 2 segundos (120 frames) tenta dar dash
                if (distToPlayer < 500 && this.stateTimer > 120) {
                    this.speederState = 'charge';
                    this.stateTimer = 0; // Reinicia timer para usar no Charge
                    this.vel = new Vector(0, 0); // Freia
                }
            }
            // 2. CHARGE: Prepara o pulo (Aviso visual)
            else if (this.speederState === 'charge') {
                // Trava a mira onde o player está AGORA (não persegue mais)
                if (this.stateTimer === 1) {
                    const predict = player.vel.mult(20); // Tenta adivinhar levemente
                    this.dashDir = player.pos.add(predict).sub(this.pos).norm();
                }

                // Fica parado "tremendo" por 0.8 segundos (45 frames)
                this.vel = this.vel.mult(0.8);

                if (this.stateTimer > 45) {
                    this.speederState = 'dash';
                    this.stateTimer = 0;
                    // Som de Dash pode ser tocado aqui via flag ou verificado no Game.ts
                }
            }
            // 3. DASH: O Ataque
            else if (this.speederState === 'dash') {
                // Velocidade extrema (25px por frame)
                const dashSpeed = this.rageMode ? 30 : 22;
                this.vel = this.dashDir.mult(dashSpeed);

                // REDUÇÃO DE DANO (Mecânica solicitada)
                // Enquanto corre, o atrito cria um escudo de calor
                this.damageReduction = 0.6; // 60% de resistência a dano

                // Duração do Dash (curta explosão)
                if (this.stateTimer > 25) {
                    this.speederState = 'cooldown';
                    this.stateTimer = 0;
                }
            }
            // 4. COOLDOWN: Descanso pós-ataque
            else if (this.speederState === 'cooldown') {
                this.vel = this.vel.mult(0.9); // Desacelera até parar

                // Volta a perseguir depois de 1 segundo
                if (this.stateTimer > 60) {
                    this.speederState = 'chase';
                    this.stateTimer = 0;
                }
            }
        }
        // --- FIM DA LÓGICA DO SPEEDER ---

        // Outros Tipos (Tank, Grunt, etc...)
        else if (this.type === 'tank') {
            this.vel = vecToPlayer.mult(effectiveSpeed);
            enemies.forEach(e => {
                if (e.pos.dist(this.pos) < 300 && e.hp < e.maxHp && this.stateTimer % 60 === 0) {
                    e.hp = Math.min(e.maxHp, e.hp + 5);
                }
            });
        }
        else if (this.type === 'sniper') {
            const idealRange = 600;
            if (distToPlayer < idealRange - 100) this.vel = vecToPlayer.mult(-effectiveSpeed);
            else if (distToPlayer > idealRange + 100) this.vel = vecToPlayer.mult(effectiveSpeed);
            else this.vel = this.vel.mult(0.9);
        }
        else {
            this.vel = vecToPlayer.mult(effectiveSpeed);
        }

        this.pos = this.pos.add(this.vel);

        // Borda do mapa (Speeder pode bater na parede e deslizar)
        this.pos.x = Math.max(50, Math.min(WORLD_SIZE - 50, this.pos.x));
        this.pos.y = Math.max(50, Math.min(WORLD_SIZE - 50, this.pos.y));

        // --- SISTEMA DE ARMAS ---
        // Speeder foi removido daqui propositalmente. Ele é 100% Melee.

        const fireRate = this.rageMode ? 50 : 70;
        if (this.weaponTimer > fireRate && this.spawnAnimationTimer <= 0) {
            this.weaponTimer = 0;
            const dmg = Math.max(10, player.maxHp * 0.15);

            if (this.type === 'sniper') {
                const aim = player.pos.sub(this.pos).norm();
                bullets.push(new Bullet(this.pos, aim.mult(18), dmg * 2, 15, 180, 1, true));
            }
            else if (this.type === 'tank') {
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 / 8) * i + (this.stateTimer * 0.05);
                    bullets.push(new Bullet(this.pos, Vector.fromAngle(angle).mult(6), dmg, 20, 150, 1, true));
                }
            }
            else if (this.type !== 'speeder') { // Garantia extra que speeder não atira
                const lead = player.vel.mult(10);
                const aim = player.pos.add(lead).sub(this.pos).norm();
                bullets.push(new Bullet(this.pos, aim.mult(10), dmg, 14, 140, 1, true));
            }
        }

        return bullets;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();

        // Animação de nascimento (Spawn)
        if (this.spawnAnimationTimer > 0) {
            const pct = 1 - (this.spawnAnimationTimer / 60);
            ctx.translate(this.pos.x, this.pos.y);
            ctx.scale(pct, pct);
            ctx.translate(-this.pos.x, -this.pos.y);
        }

        ctx.translate(this.pos.x, this.pos.y);

        // --- EFEITOS VISUAIS ESPECÍFICOS DO SPEEDER ---
        if (this.type === 'speeder') {
            // 1. CHARGE: Linha de mira piscando (Mantive, pois é útil)
            if (this.speederState === 'charge') {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(0, 0);
                // Desenha a linha na direção travada
                ctx.lineTo(this.dashDir.x * 400, this.dashDir.y * 400);
                ctx.strokeStyle = `rgba(255, 140, 0, ${Math.random() * 0.8 + 0.2})`; // Laranja mais intenso
                ctx.lineWidth = 3;
                ctx.setLineDash([15, 10]);
                ctx.stroke();
                ctx.restore();

                // Tremor de "carregando"
                ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
            }
        }

        // Rotação para encarar o movimento
        if (this.vel.mag() > 0.1) ctx.rotate(Math.atan2(this.vel.y, this.vel.x));

        // --- DEFINIÇÃO DE CORES ---
        let color = COLORS.BOSS;
        // Speeder: Laranja Neon Vibrante
        if (this.type === 'speeder') color = '#ff9900';
        if (this.type === 'tank') color = '#bd00ff';
        if (this.type === 'sniper') color = '#ffffff';

        if (this.rageMode && this.stateTimer % 10 < 5) color = '#ff0000';

        // Efeito visual de redução de dano (Dash) - Brilho intenso
        if (this.damageReduction > 0) {
            // Em vez de ficar branco, ele fica um laranja super saturado e brilhante
            ctx.shadowBlur = 30;
            color = '#ffbb55';
        } else {
            ctx.shadowBlur = 20;
        }

        const drawColor = this.hitFlash > 0 ? '#ffffff' : color;
        ctx.shadowColor = drawColor;
        ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : (color + '44'); // Transparente
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = 3;

        const s = this.size;

        // --- 2. NOVO EFEITO DE PROPULSÃO (AFTERBURNER) ---
        // Desenhamos ANTES do corpo para ficar atrás
        if (this.type === 'speeder' && this.speederState === 'dash') {
            ctx.save();
            // O efeito sai da base do triângulo (x = -s/2)
            ctx.translate(-s / 2, 0);

            // 3 camadas de chama para dar profundidade
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                // A chama varia de tamanho aleatoriamente para parecer viva
                const flameLen = s * (1.5 + i * 0.5) + Math.random() * (s * 0.5);
                const flameWidth = s * (0.8 - i * 0.2);

                ctx.moveTo(0, flameWidth / 2);
                ctx.lineTo(-flameLen, 0); // Ponta da chama para trás
                ctx.lineTo(0, -flameWidth / 2);
                ctx.closePath();

                // Gradiente de cor: Amarelo no centro, Laranja nas bordas
                const alpha = 0.6 - (i * 0.15);
                ctx.fillStyle = i === 0 ? `rgba(255, 255, 100, ${alpha})` : `rgba(255, 100, 0, ${alpha})`;
                ctx.fill();
            }
            ctx.restore();
        }

        // --- 3. DESENHO DO CORPO ---
        ctx.beginPath();

        if (this.type === 'tank') {
            for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); }
        }
        else if (this.type === 'speeder') {
            // A NOVA SKIN: Triângulo Isósceles Limpo (Base Inimigo)
            // Ponta na frente (s), base atrás (-s/2)
            ctx.moveTo(s, 0);
            ctx.lineTo(-s / 2, s / 2);
            ctx.lineTo(-s / 2, -s / 2);
            ctx.closePath();
        }
        else if (this.type === 'sniper') {
            ctx.arc(0, 0, s / 2, 0, Math.PI * 2); ctx.moveTo(s, 0); ctx.lineTo(s * 1.2, 0);
        } else {
            ctx.rect(-s / 2, -s / 2, s, s);
        }
        ctx.fill();
        ctx.stroke();

        // --- DETALHE ELITE: Núcleo de Energia ---
        // Desenha um triângulo menor e mais brilhante dentro do Speeder
        if (this.type === 'speeder' && this.hitFlash === 0) {
            ctx.beginPath();
            const innerS = s * 0.5;
            ctx.moveTo(innerS, 0);
            ctx.lineTo(-innerS / 2, innerS / 2);
            ctx.lineTo(-innerS / 2, -innerS / 2);
            ctx.closePath();
            ctx.fillStyle = '#ffffff'; // Núcleo branco quente
            ctx.globalAlpha = 0.7;
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        ctx.restore();
        this.drawHealthBar(ctx, color);
    }

    private drawHealthBar(ctx: CanvasRenderingContext2D, color: string) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        const barW = 80;
        const barY = -this.size - 20;

        // Ícone de Coroa e Nome
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`👑 ${this.name}`, 0, barY - 8);

        // Fundo Preto
        ctx.fillStyle = '#000';
        ctx.fillRect(-barW / 2, barY, barW, 6);

        // Vida Atual (na cor do Boss)
        const pct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = color;
        ctx.fillRect(-barW / 2, barY, barW * pct, 6);

        // Borda Branca
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(-barW / 2, barY, barW, 6);

        ctx.restore();
    }
}
// --- TRUE BOSS: CURSOR (REWORKED) ---

type CursorState = 'orbit' | 'snipe' | 'dasher' | 'teleport';

export class Cursor implements IBoss {
    pos: Vector;
    vel: Vector;
    hp: number;
    maxHp: number;
    name: string = "CURSOR";
    size: number = 60;
    contactDamage: number = 30;
    hitFlash: number = 0;
    xpValue: number;

    pendingSpawns: Enemy[] = [];
    pendingAreaEffects: AreaEffect[] = [];
    pendingBossSpawns: IBoss[] = [];

    // State Machine
    state: CursorState = 'orbit';
    stateTimer: number = 0;

    // Combat Props
    snipeCharge: number = 0;
    dashDir: Vector = new Vector(0, 0);
    playerPredictedPos: Vector = new Vector(0, 0);

    constructor(x: number, y: number, playerLevel: number) {
        this.pos = new Vector(x, y);
        this.vel = new Vector(0, 0);
        // Buffed Health
        this.maxHp = 4000 + (playerLevel * 250);
        this.hp = this.maxHp;
        this.xpValue = 5000 + (playerLevel * 500);
    }

    update(player: Player, enemies: Enemy[]): Bullet[] {
        if (this.hitFlash > 0) this.hitFlash--;
        this.stateTimer++;
        const bullets: Bullet[] = [];

        const dist = this.pos.dist(player.pos);
        const toPlayer = player.pos.sub(this.pos).norm();

        // STATE MACHINE
        switch (this.state) {
            case 'orbit':
                // High speed movement, hard to hit, maintaining distance
                const idealDist = 600;
                let targetVel = new Vector(0, 0);

                // Strafing
                const orbitDir = new Vector(-toPlayer.y, toPlayer.x).mult(this.stateTimer % 200 > 100 ? 1 : -1);

                if (dist < idealDist - 100) targetVel = toPlayer.mult(-4).add(orbitDir.mult(2));
                else if (dist > idealDist + 100) targetVel = toPlayer.mult(5).add(orbitDir.mult(2));
                else targetVel = orbitDir.mult(5); // Pure orbit

                this.vel = this.vel.add(targetVel.sub(this.vel).mult(0.1));

                // Basic attack: Rapid pulses
                if (this.stateTimer % 15 === 0) {
                    bullets.push(new Bullet(this.pos, toPlayer.mult(8), 15, 12, 180, 1, true));
                }

                // Switch State
                if (this.stateTimer > 240) {
                    this.stateTimer = 0;
                    const rand = Math.random();
                    if (rand < 0.4) this.state = 'snipe';
                    else if (rand < 0.7) this.state = 'dasher';
                    else this.state = 'teleport';
                }
                break;

            case 'snipe':
                this.vel = this.vel.mult(0.85); // Brake
                this.snipeCharge++;

                // Track player + prediction
                this.playerPredictedPos = player.pos.add(player.vel.mult(30)); // Look 0.5s ahead

                if (this.snipeCharge > 60) {
                    // FIRE
                    const aim = this.playerPredictedPos.sub(this.pos).norm();
                    // High speed, Huge damage, Big Hitbox (15 radius)
                    bullets.push(new Bullet(this.pos, aim.mult(25), 60, 15, 300, 1, true));
                    // Recoil
                    this.vel = aim.mult(-10);

                    this.state = 'orbit';
                    this.stateTimer = 0;
                    this.snipeCharge = 0;
                }
                break;

            case 'dasher':
                if (this.stateTimer === 1) {
                    // Lock direction
                    this.dashDir = toPlayer;
                }
                // Windup
                if (this.stateTimer < 40) {
                    this.vel = this.dashDir.mult(-2); // Pull back
                }
                // DASH
                else if (this.stateTimer < 60) {
                    this.vel = this.dashDir.mult(35); // Super speed
                    // Drop mines/bullets behind
                    if (this.stateTimer % 2 === 0) {
                        bullets.push(new Bullet(this.pos, new Vector(0, 0), 10, 8, 300, 1, true));
                    }
                }
                // Cooldown
                else {
                    this.vel = this.vel.mult(0.9);
                    if (this.stateTimer > 90) {
                        this.state = 'orbit';
                        this.stateTimer = 0;
                    }
                }
                break;

            case 'teleport':
                // Vanish
                if (this.stateTimer === 1) {
                    // Visual effect
                    this.hitFlash = 10;
                }
                if (this.stateTimer > 20 && this.stateTimer < 60) {
                    // "Invis" - Move far away instantly
                    this.pos = new Vector(-1000, -1000);
                }
                if (this.stateTimer === 60) {
                    // Reappear random location near player
                    const angle = Math.random() * Math.PI * 2;
                    this.pos = player.pos.add(Vector.fromAngle(angle).mult(500));

                    // Ambush Ring
                    for (let i = 0; i < 12; i++) {
                        const a = (i / 12) * Math.PI * 2;
                        bullets.push(new Bullet(this.pos, Vector.fromAngle(a).mult(6), 20, 10, 180, 1, true));
                    }
                    this.state = 'orbit';
                    this.stateTimer = 0;
                }
                break;
        }

        this.pos = this.pos.add(this.vel);
        // Boundaries
        this.pos.x = Math.max(100, Math.min(WORLD_SIZE - 100, this.pos.x));
        this.pos.y = Math.max(100, Math.min(WORLD_SIZE - 100, this.pos.y));

        return bullets;
    }

    // Em src/entities/Boss.ts -> Dentro da classe Cursor

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();

        // 1. Efeito de Tremulação (Glitch)
        if (this.state === 'teleport' || this.hitFlash > 0) {
            const shake = 5;
            ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        }

        // 2. Translação para a posição do Boss
        ctx.translate(this.pos.x, this.pos.y);

        // 3. Lógica de Mira e Rotação
        // O sprite "padrão" aponta para BAIXO (eixo Y positivo)
        // Precisamos rotacionar para alinhar com a velocidade ou o alvo
        let targetAngle = Math.atan2(this.vel.y, this.vel.x);

        if (this.state === 'snipe') {
            // No modo Snipe, mira onde o jogador vai estar
            const aimVector = this.playerPredictedPos.sub(this.pos);
            targetAngle = Math.atan2(aimVector.y, aimVector.x);

            // --- CORREÇÃO DO LASER ---
            // Desenhamos o laser ANTES de rotacionar o contexto para o sprite,
            // usando o vetor direto. Isso evita erros de ângulo.
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(0, 0); // Origem (centro do boss)
            ctx.lineTo(aimVector.x, aimVector.y); // Destino (ponto previsto)

            // Estilo do Laser
            const chargePct = this.snipeCharge / 60; // 0.0 a 1.0
            ctx.strokeStyle = `rgba(255, 0, 0, ${chargePct})`;
            ctx.lineWidth = 2 + (chargePct * 2); // Fica mais grosso ao carregar
            ctx.setLineDash([15, 10]); // Tracejado
            ctx.stroke();
            ctx.setLineDash([]); // Limpa o tracejado
            ctx.restore();
        }

        // 4. Aplica a rotação ao Sprite
        // Subtraímos 90 graus (PI/2) porque o desenho do cursor aponta para baixo (90 graus)
        // e queremos que "baixo" se torne "frente" (ângulo alvo)
        ctx.rotate(targetAngle - Math.PI / 2);

        // 5. Desenho da Skin do Cursor (Ponteiro Gigante)
        const scale = 1.5;

        // Sombra com Glitch (Deslocada)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
        this.drawCursorPath(ctx, scale, 5, 5); // Desenha deslocado
        ctx.fill();

        // Corpo Principal
        ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#ffff00'; // Flash Branco ou Amarelo Padrão
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;

        this.drawCursorPath(ctx, scale, 0, 0); // Desenha centralizado
        ctx.fill();
        ctx.stroke();

        // Olho Digital (Detalhe)
        if (this.state !== 'teleport') {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            // Desenha o "olho" na parte mais larga do cursor
            ctx.arc(0, 40 * scale, 6 * scale, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        // Barra de Vida (Desenhada por último para ficar por cima de tudo)
        this.drawHealthBar(ctx);
    }

    // Helper para desenhar o caminho do vetor (evita repetição de código)
    private drawCursorPath(ctx: CanvasRenderingContext2D, scale: number, offsetX: number, offsetY: number) {
        ctx.beginPath();
        // Ponta da seta em (0,0) + offset
        ctx.moveTo(offsetX, offsetY);
        // Lado Esquerdo
        ctx.lineTo(offsetX - 30 * scale, offsetY + 80 * scale);
        // Recorte da Cauda (lado esquerdo)
        ctx.lineTo(offsetX - 10 * scale, offsetY + 75 * scale);
        // Cauda Esquerda
        ctx.lineTo(offsetX - 5 * scale, offsetY + 110 * scale);
        // Cauda Direita
        ctx.lineTo(offsetX + 5 * scale, offsetY + 110 * scale);
        // Recorte da Cauda (lado direito)
        ctx.lineTo(offsetX + 10 * scale, offsetY + 75 * scale);
        // Lado Direito
        ctx.lineTo(offsetX + 30 * scale, offsetY + 80 * scale);
        ctx.closePath();
    }

    private drawHealthBar(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        const barW = 100; // Barra um pouco maior que a do WaveChief
        const barY = -this.size - 40; // Posição acima do Boss

        // Ícone e Nome
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`⚠️ ${this.name}`, 0, barY - 8);

        // Fundo da Barra
        ctx.fillStyle = '#000';
        ctx.fillRect(-barW / 2, barY, barW, 8);

        // Vida Atual (Vermelho para perigo)
        const pct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(-barW / 2, barY, barW * pct, 8);

        // Borda
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(-barW / 2, barY, barW, 8);

        ctx.restore();
    }
}

// --- TRUE BOSS: MONOLITH (REWORKED) ---

type MonolithState = 'shield' | 'spiral' | 'beam' | 'void';

export class Monolith implements IBoss {
    pos: Vector;
    vel: Vector = new Vector(0, 0);
    hp: number;
    maxHp: number;
    name: string = "MONOLITH";
    size: number = 120;
    contactDamage: number = 50;
    hitFlash: number = 0;
    xpValue: number;

    pendingSpawns: Enemy[] = [];
    pendingAreaEffects: AreaEffect[] = [];
    pendingBossSpawns: IBoss[] = [];

    state: MonolithState = 'shield';
    stateTimer: number = 0;
    rotation: number = 0;

    constructor(x: number, y: number, playerLevel: number) {
        this.pos = new Vector(x, y);
        // Tankier HP
        this.maxHp = 8000 + (playerLevel * 500);
        this.hp = this.maxHp;
        this.xpValue = 10000 + (playerLevel * 500);
    }

    update(player: Player, enemies: Enemy[]): Bullet[] {
        if (this.hitFlash > 0) this.hitFlash--;
        this.stateTimer++;
        this.rotation += 0.01;
        const bullets: Bullet[] = [];

        const dist = this.pos.dist(player.pos);
        const toPlayer = player.pos.sub(this.pos).norm();

        switch (this.state) {
            case 'shield':
                // Check minions
                const minions = enemies.filter(e => e.type === 'mini_monolith');

                // Spawn minions if missing
                if (minions.length < 4 && this.stateTimer % 60 === 0) {
                    this.pendingSpawns.push(new Enemy(this.pos.x + (Math.random() - 0.5) * 300, this.pos.y + (Math.random() - 0.5) * 300, 'mini_monolith'));
                }

                // Passive fire
                if (this.stateTimer % 90 === 0) {
                    for (let i = 0; i < 8; i++) {
                        const a = (i / 8) * Math.PI * 2 + this.rotation;
                        bullets.push(new Bullet(this.pos, Vector.fromAngle(a).mult(5), 20, 10, 240, 1, true));
                    }
                }

                if (this.stateTimer > 600) { // 10s
                    this.state = 'spiral';
                    this.stateTimer = 0;
                }
                break;

            case 'spiral':
                // Bullet Hell
                this.rotation += 0.05;
                if (this.stateTimer % 4 === 0) { // Rapid fire
                    for (let i = 0; i < 4; i++) {
                        const a = (i / 4) * Math.PI * 2 + this.rotation;
                        // Large hitbox (radius 8), visual might be smaller
                        bullets.push(new Bullet(this.pos, Vector.fromAngle(a).mult(6), 15, 8, 300, 1, true));
                    }
                }

                if (this.stateTimer > 300) {
                    this.state = 'void';
                    this.stateTimer = 0;
                }
                break;

            case 'void':
                // Spawn Black Holes on Player
                if (this.stateTimer % 120 === 0 && this.stateTimer < 400) {
                    // Prediction spawn
                    const spawnPos = player.pos.add(player.vel.mult(20));
                    this.pendingAreaEffects.push(new AreaEffect(spawnPos.x, spawnPos.y, 'black_hole'));
                }

                // Defensive Barrage
                if (this.stateTimer % 30 === 0) {
                    bullets.push(new Bullet(this.pos, toPlayer.mult(10), 20, 12, 180, 1, true));
                }

                if (this.stateTimer > 480) {
                    this.state = 'beam';
                    this.stateTimer = 0;
                }
                break;

            case 'beam':
                // Tracking Laser
                if (this.stateTimer % 5 === 0) {
                    // Creates a line of bullets
                    bullets.push(new Bullet(this.pos, toPlayer.mult(20), 40, 6, 120, 99, true));
                }

                if (this.stateTimer > 180) {
                    this.state = 'shield';
                    this.stateTimer = 0;
                }
                break;
        }

        return bullets;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.rotation);

        const drawColor = this.hitFlash > 0 ? '#fff' : '#4444ff';
        ctx.fillStyle = drawColor;
        ctx.shadowBlur = 30;
        ctx.shadowColor = drawColor;

        // Main Block
        ctx.fillRect(-60, -100, 120, 200);

        // Inner Void
        ctx.fillStyle = '#000';
        // Pulse size based on state
        const voidW = this.state === 'spiral' ? 60 + Math.sin(this.stateTimer * 0.5) * 10 : 40;
        ctx.fillRect(-voidW / 2, -80, voidW, 160);

        // State indicator
        if (this.state === 'beam') {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
        this.drawHealthBar(ctx);
    }

    private drawHealthBar(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.fillStyle = '#000'; ctx.fillRect(-60, -120, 120, 10);
        ctx.fillStyle = '#4444ff'; ctx.fillRect(-60, -120, 120 * (this.hp / this.maxHp), 10);
        ctx.restore();
    }
}

// --- GENERATOR HELPER FOR AFFIXES ONLY ---

class BossGenerator {
    static generateAffixes(wave: number): BossAffixType[] {
        const affixes: BossAffixType[] = [];
        if (wave > 5) if (Math.random() < 0.5) affixes.push('vampiric');
        if (wave > 10) if (Math.random() < 0.5) affixes.push('reactive');
        if (wave > 15) if (Math.random() < 0.5) affixes.push('tether');
        return affixes;
    }
}
