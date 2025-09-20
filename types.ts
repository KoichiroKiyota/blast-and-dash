
export enum Tile {
  FLOOR,
  WALL,
  CRATE,
  BOMB,
  EXPLOSION,
  POWERUP_BOMB,
  POWERUP_RANGE,
  POWERUP_SPEED,
  EXIT,
}

export type GameStatus = 'START_MENU' | 'PLAYING' | 'WON' | 'LOST';

export interface Position {
  x: number;
  y: number;
}

export interface Player extends Position {
  bombsMax: number;
  bombsLeft: number;
  range: number;
  speed: number;
  isAlive: boolean;
}

export interface Enemy extends Position {
  id: number;
  direction: 'up' | 'down' | 'left' | 'right';
}

export interface Bomb extends Position {
  // FIX: Add a unique id to the bomb for tracking.
  id: number;
  timer: number;
  range: number;
}

export interface Explosion extends Position {
  timer: number;
}

export interface GameState {
  board: Tile[][];
  player: Player;
  enemies: Enemy[];
  bombs: Bomb[];
  explosions: Explosion[];
  gameStatus: GameStatus;
  level: number;
  score: number;
}

export type GameAction =
  | { type: 'START_GAME' }
  | { type: 'TICK' }
  | { type: 'MOVE'; dx: number; dy: number }
  | { type: 'PLACE_BOMB' }
  | { type: 'RESET_GAME' }
  | { type: 'NEXT_LEVEL' };
