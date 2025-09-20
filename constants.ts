export const GRID_WIDTH = 17;
export const GRID_HEIGHT = 13;
export const TILE_SIZE = 40; // in pixels

export const BOMB_TIMER = 120; // 2 seconds at 60fps
export const EXPLOSION_TIMER = 30; // 0.5 seconds at 60fps

export const PLAYER_START_POS = { x: 1, y: 1 };
export const PLAYER_START_SPEED = 0.12; // Increased from 0.08
export const PLAYER_START_BOMBS = 1;
export const PLAYER_START_RANGE = 1;

export const ENEMY_START_SPEED = 0.07; // Added constant for enemy speed

export const CRATE_DENSITY = 0.6;
export const POWERUP_CHANCE = 0.3;

export const LEVEL_CONFIGS = [
  { level: 1, enemies: 3 },
  { level: 2, enemies: 4 },
  { level: 3, enemies: 5 },
];
