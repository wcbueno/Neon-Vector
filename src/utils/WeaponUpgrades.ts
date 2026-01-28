import { Player } from '../entities/Player';

export interface WeaponUpgrade {
  id: string;
  name: string;
  description: string;
  type: 'weapon';
  apply: (player: Player) => void;
}

export const WEAPON_UPGRADES: WeaponUpgrade[] = [
  {
    id: 'split_shot',
    name: 'Split Fire',
    description: '+1 Projectile, +15° Spread',
    type: 'weapon',
    apply: (p) => { 
      p.projectileCount += 1; 
      p.spread += (Math.PI / 12); // 15 degrees
    }
  },
  {
    id: 'railgun',
    name: 'Railgun Rounds',
    description: '+2 Piercing, +30% Bullet Speed',
    type: 'weapon',
    apply: (p) => { 
      p.piercing += 2;
      p.bulletSpeed *= 1.3;
    }
  },
  {
    id: 'heavy_caliber',
    name: 'Heavy Caliber',
    description: '+50% Damage, +50% Bullet Size',
    type: 'weapon',
    apply: (p) => { 
      p.damage *= 1.5;
      p.bulletSize *= 1.5;
    }
  },
  {
    id: 'sniper',
    name: 'Long Range',
    description: '+100% Range, +20% Speed',
    type: 'weapon',
    apply: (p) => { 
      p.bulletLife *= 2;
      p.bulletSpeed *= 1.2;
    }
  },
  {
    id: 'rapid_fire',
    name: 'Gatling Protocol',
    description: '+40% Fire Rate, -10% Damage',
    type: 'weapon',
    apply: (p) => { 
      p.fireRate = Math.max(2, p.fireRate * 0.6);
      p.damage *= 0.9;
    }
  },
  {
    id: 'focus_fire',
    name: 'Focus Lens',
    description: '-50% Spread, +20% Damage',
    type: 'weapon',
    apply: (p) => { 
      p.spread *= 0.5;
      p.damage *= 1.2;
    }
  }
];

export const getRandomWeaponUpgrades = (count: number): WeaponUpgrade[] => {
  const shuffled = [...WEAPON_UPGRADES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};
