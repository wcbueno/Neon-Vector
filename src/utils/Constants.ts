export const WORLD_SIZE = 4000;
export const TILE_SIZE = 100;

export const PLAYER_CAPS = {
  MAX_SPEED: 22,        // Base is ~6, so ~3.5x boost limit
  MAX_DAMAGE: 200,      // Base is 10, so 20x boost limit
  MAX_PICKUP_RANGE: 800 // Base is 100, so 8x boost limit
};

export const COLORS = {
  BACKGROUND: '#050505',
  GRID: '#1a1a1a',
  PLAYER: '#00ff9d', // Neon Cyan/Green
  PLAYER_HIT: '#ffffff',
  ALLY: '#00ccff',
  
  // Enemies (The "System")
  ENEMY_GRUNT: '#ff2a2a', // Red Square
  ENEMY_SPEEDER: '#ffd000', // Yellow Triangle
  ENEMY_TANK: '#bd00ff', // Purple Hexagon
  ENEMY_SEEKER: '#ff8800', // Orange Diamond
  
  // New Enemies (Batch 1)
  ENEMY_SWARMER: '#39ff14', // Neon Green
  ENEMY_BRUTE: '#8b0000', // Dark Red
  ENEMY_SNIPER: '#ffffff', // White
  ENEMY_EXPLODER: '#ff4500', // Orange Red
  ENEMY_WAVER: '#ff69b4', // Hot Pink
  ENEMY_TELEPORTER: '#00ffff', // Cyan
  ENEMY_TURRET: '#ffd700', // Gold
  ENEMY_ORBIT: '#00ced1', // Dark Turquoise
  ENEMY_ARMORED: '#708090', // Slate Gray
  ENEMY_GHOST: '#9400d3', // Dark Violet

  // New Enemies (Batch 2 - The 10 additions)
  ENEMY_FRACTAL: '#ff00ff', // Magenta
  ENEMY_MENDER: '#00ff00', // Pure Green
  ENEMY_LANCER: '#ffff00', // Yellow
  ENEMY_VORTEX: '#4b0082', // Indigo
  ENEMY_TRAILBLAZER: '#ff7f50', // Coral
  ENEMY_LAYER: '#808000', // Olive
  ENEMY_BEAMER: '#e0ffff', // Light Cyan
  ENEMY_AEGIS: '#4682b4', // Steel Blue
  ENEMY_GLITCH: '#000000', // Black/White flicker handled in draw
  ENEMY_CARRIER: '#a52a2a', // Brown

  // Modular Boss Colors
  BOSS_CHASSIS_JUGGERNAUT: '#880000', // Dark Red
  BOSS_CHASSIS_ASSASSIN: '#cccc00',   // Dark Yellow
  BOSS_CHASSIS_CONTROLLER: '#008888', // Dark Cyan

  BOSS_WEAPON_BLAST: '#ff4400',       // Orange
  BOSS_WEAPON_PRECISION: '#aa00ff',   // Purple
  BOSS_WEAPON_SWARM: '#00ff00',       // Green

  BOSS: '#ff0055', // Fallback

  // Projectiles & FX
  BULLET: '#00ff9d',
  ORB_XP: '#00ffff', // VISIBILITY FIX: Neon Cyan (was White)
  ORB_HEALTH: '#ff0055',
  TEXT_FLOAT: '#ffffff',
  TEXT_CRIT: '#ffff00',
  TEXT_DAMAGE: '#ff0055'
};

export const CONSTANTS = {
  SCREEN_SHAKE_DECAY: 0.9,
  FRICTION: 0.92,
  ACCELERATION: 1.5,
  MAX_SPEED_BASE: 6,
  DASH_COOLDOWN: 180, // Frames
  SHOCKWAVE_COOLDOWN: 300, // Frames
};