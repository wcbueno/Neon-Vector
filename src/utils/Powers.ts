export interface Power {
  id: string;
  name: string;
  type: 'active' | 'passive';
  description: string;
  cooldown?: number;
}

export const POWERS: Power[] = [
  // --- ATIVE SKILLS ---
  {
    id: 'shockwave', 
    name: 'Logic Bomb',
    description: 'Release a massive expanding energy ring.',
    type: 'active',
    cooldown: 600
  },
  {
    id: 'missile_swarm',
    name: 'Missile Swarm',
    description: 'Launch 16 homing missiles.',
    type: 'active',
    cooldown: 900
  },
  {
    id: 'time_warp',
    name: 'Time Warp',
    description: 'Slow down time for enemies by 85%.',
    type: 'active',
    cooldown: 1200
  },
  /* REMOVIDO TEMPORARIAMENTE
  {
    id: 'black_hole',
    name: 'Singularity',
    description: 'Summon a gravity well that crushes enemies.',
    type: 'active',
    cooldown: 1500
  },
  */

  // --- PASSIVE POWERS ---
  {
    id: 'ally_drone',
    name: 'Attack Drone',
    description: 'Spawns an autonomous support unit (Max 3).',
    type: 'passive'
  },
  {
    id: 'plasma_aura',
    name: 'Plasma Aura',
    description: 'Deal constant damage to nearby enemies.',
    type: 'passive'
  }
];