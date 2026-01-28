import { Player } from '../entities/Player';

export type UpgradeTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'glitch' | 'synergy' | 'omega';
export type UpgradeCategory = 'offense' | 'defense' | 'utility' | 'tech' | 'ballistics' | 'special';

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  tier: UpgradeTier;
  category: UpgradeCategory;
  tags: string[]; // NOVO: Para identificar builds (ex: 'fire', 'speed', 'bullet')
  weight: number;
  apply: (player: Player) => void;
  requirements?: (player: Player) => boolean; // NOVO: Condição para aparecer
}

// Visual Config for UI
export const TIER_CONFIG: Record<UpgradeTier, { color: string, label: string, weight: number }> = {
  common: { color: '#9ca3af', label: 'COMMON (v1.0)', weight: 100 },
  uncommon: { color: '#4ade80', label: 'UNCOMMON (v2.0)', weight: 60 },
  rare: { color: '#60a5fa', label: 'RARE (v3.0)', weight: 30 },
  epic: { color: '#a855f7', label: 'EPIC (v4.0)', weight: 15 },
  legendary: { color: '#f59e0b', label: 'LEGENDARY (v5.0)', weight: 5 },
  glitch: { color: '#ef4444', label: 'FATAL_ERROR', weight: 8 },        // Aumentei o peso para aparecerem mais
  synergy: { color: '#00ffcc', label: 'SYSTEM_SYNC', weight: 10 },      // NOVO: Cyan Neon
  omega: { color: '#fbbf24', label: 'ΩMEGA', weight: 1 },
};

const _U: Upgrade[] = [];

// Helper atualizado com tags
const addStat = (
  id: string, name: string, tier: UpgradeTier, desc: string,
  fn: (p: Player) => void, cat: UpgradeCategory = 'utility', tags: string[] = []
) => {
  _U.push({
    id, name, description: desc, tier, category: cat, tags, apply: fn, weight: TIER_CONFIG[tier].weight
  });
};

// --- OFFENSE (Ataque) ---
addStat('dmg_1', 'Force Module', 'common', '+10% Damage', p => p.damage *= 1.1, 'offense', ['damage']);
addStat('rate_1', 'Cycle Booster', 'common', '+10% Fire Rate', p => p.fireRate *= 0.9, 'offense', ['fire_rate']);
// Raro: Multishot (O mais desejado)
addStat('multi_1', 'Split Chamber', 'rare', '+1 Projectile', p => p.projectiles += 1, 'offense', ['multishot']);
// Raro: Dano Crítico
addStat('crit_dmg', 'Lethal Output', 'uncommon', '+20% Crit Dmg', p => p.critMult += 0.2, 'offense', ['crit']);


// --- DEFENSE (Defesa) - NERF NA VIDA ---
// Antes era +30. Agora +15. É útil, mas não obrigatório.
addStat('hp_1', 'Hull Plating', 'common', '+15 Max HP', p => { p.maxHp += 15; p.hp += 15; }, 'defense', ['tank']);
addStat('regen_1', 'Nanobots', 'uncommon', '+1 HP/sec', p => p.regen += 1, 'defense', ['sustain']);
// Novo: Armadura (Redução de Dano fixo - mecânica simples)
addStat('armor_1', 'Reinforced Mesh', 'rare', '-2 Damage Taken', p => {/* Implementar damage reduction no player se quiser */ p.maxHp += 25; }, 'defense', ['tank']);


// --- UTILITY (Utilidade) - ONDE FALTAVA COISA ---
// 1. Coleta (Magnet)
addStat('mag_1', 'Tractor Beam', 'common', '+50 Pickup Range', p => p.magnetRadius += 50, 'utility', ['magnet']);

// 2. XP Gain (Investimento)
addStat('xp_1', 'Neural Link', 'common', '+15% XP Gain', p => p.xpMult *= 1.15, 'utility', ['xp']);

// 3. Velocidade
addStat('spd_1', 'Thruster', 'common', '+10% Speed', p => p.speed *= 1.10, 'utility', ['speed']);

// 4. Dash (Mobilidade)
addStat('dash_cd', 'Coolant Injector', 'uncommon', '-15% Dash Cooldown', p => p.dashCooldownMult *= 0.85, 'utility', ['dash']);
addStat('dash_dist', 'Afterburner', 'uncommon', '+20% Dash Distance', p => {/* Ajustar duration do dash no player se quiser */ }, 'utility', ['dash']);

// --- SINERGIAS (O "Pulo do Gato") ---
// Estes upgrades só aparecem se o jogador já tiver investido em certos status

_U.push({
  id: 'syn_static',
  name: 'Static Friction',
  description: 'Running generates electricity (Dmg Aura)',
  tier: 'synergy',
  category: 'special',
  tags: ['speed', 'electric'],
  weight: 20,
  apply: (p) => { p.hasPlasmaAura = true; p.speed *= 1.1; },
  requirements: (p) => p.speed > 8 // Requer que o jogador já seja rápido
});

_U.push({
  id: 'syn_vampire',
  name: 'Blood Cooling',
  description: 'Crit Kills heal 1 HP',
  tier: 'synergy',
  category: 'special',
  tags: ['crit', 'sustain'],
  weight: 20,
  apply: (p) => {
    p.vampirism = true; // Ativa a flag no jogador
  },
  requirements: (p) => p.critChance > 0.2 // Só aparece se tiver > 20% de Crítico
});

_U.push({
  id: 'syn_heavy',
  name: 'Heavy Artillery',
  description: 'Convert Speed to Damage (1:5 ratio)',
  tier: 'synergy',
  category: 'offense',
  tags: ['damage', 'tank'],
  weight: 20,
  apply: (p) => {
    const speedSacrifice = p.speed * 0.2;
    p.speed -= speedSacrifice;
    p.damage += speedSacrifice * 50;
  },
  requirements: (p) => p.damage > 50 && p.maxHp > 200 // Build "Tank"
});

// --- GLITCH / OVERCLOCK (Alto Risco, Alta Recompensa) ---

_U.push({
  id: 'glitch_segfault',
  name: 'Segmentation Fault',
  description: 'Projectiles phase through walls but you take +50% Dmg',
  tier: 'glitch',
  category: 'special',
  tags: ['glitch'],
  weight: 10,
  apply: (p) => {
    p.piercing += 10;
    p.maxHp = Math.floor(p.maxHp * 0.8); // Reduz HP máximo efetivo
  }
});

_U.push({
  id: 'glitch_memory_leak',
  name: 'Memory Leak',
  description: '+100% Fire Rate, but you constantly lose XP',
  tier: 'glitch',
  category: 'offense',
  tags: ['glitch', 'fire_rate'],
  weight: 10,
  apply: (p) => {
    p.fireRate *= 0.5;
    // Lógica de perder XP precisa ser no update do Game loop
    // Vamos usar uma flag no player, ex: p.hasMemoryLeak = true;
  }
});

_U.push({
  id: 'glitch_kernel_panic',
  name: 'KERNEL_PANIC',
  description: 'Set HP to 1. Damage x5. Shield +100.',
  tier: 'glitch',
  category: 'special',
  tags: ['glitch', 'glass_cannon'],
  weight: 5,
  apply: (p) => {
    p.maxHp = 1;
    p.hp = 1;
    p.damage *= 5;
    p.invulnerable = 120; // 2s de invuln ao pegar
  }
});

// FILLERS (Aqueles que aparecem quando acaba a sorte)
// Ajustados para 10% também, para nunca ser "ruim" pegar um filler.
for (let i = 0; i < 5; i++) addStat(`common_dmg_${i}`, `Patch v1.${i}`, 'common', '+10% Dmg', p => p.damage *= 1.1, 'offense', ['damage']);
for (let i = 0; i < 5; i++) addStat(`common_hp_${i}`, `Patch v2.${i}`, 'common', '+25 HP', p => { p.maxHp += 25; p.hp += 25; }, 'defense', ['tank']);

export const ALL_UPGRADES = _U;

export const getWeightedUpgrades = (count: number, player: Player): Upgrade[] => {
  const result: Upgrade[] = [];

  // 1. Filtrar upgrades disponíveis baseados em requerimentos
  const availablePool = ALL_UPGRADES.filter(u => {
    // Checa requerimentos customizados (Sinergias)
    if (u.requirements && !u.requirements(player)) {
      return false;
    }

    // Lógica legada de projéteis (mantida por segurança)
    if (u.id === 'split_1' && player.projectileCount > 4) return false;

    return true;
  });

  const maxAttempts = count * 10;
  let attempts = 0;

  while (result.length < count && attempts < maxAttempts) {
    attempts++;

    // Boost de peso dinâmico
    let selectionPool = availablePool.map(u => {
      let w = u.weight;
      // Se o jogador tem tags que batem com o upgrade, aumenta a chance (Sinergia suave)
      // Ex: Se jogador tem muitos itens 'fire', itens 'fire' aparecem mais
      // (Lógica simplificada para não pesar no loop)
      return { ...u, effectiveWeight: w };
    });

    const totalWeight = selectionPool.reduce((sum, u) => sum + u.effectiveWeight, 0);
    let r = Math.random() * totalWeight;

    let selected: Upgrade | null = null;
    for (const u of selectionPool) {
      if (r < u.effectiveWeight) {
        selected = u;
        break;
      }
      r -= u.effectiveWeight;
    }

    if (selected && !result.find(r => r.id === selected!.id)) {
      result.push(selected);
    }
  }

  // Fallback se não encontrar o suficiente (raro)
  if (result.length < count) {
    const fillers = ALL_UPGRADES.filter(u => u.tier === 'common').slice(0, count - result.length);
    result.push(...fillers);
  }

  return result;
};