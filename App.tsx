import React, { useEffect, useReducer, useCallback } from 'react';
import { Tile, GameState, Player, Enemy, Bomb, Explosion, GameStatus, GameAction, Position } from './types';
import {
  GRID_WIDTH,
  GRID_HEIGHT,
  TILE_SIZE,
  BOMB_TIMER,
  EXPLOSION_TIMER,
  PLAYER_START_POS,
  PLAYER_START_SPEED,
  PLAYER_START_BOMBS,
  PLAYER_START_RANGE,
  ENEMY_START_SPEED,
  CRATE_DENSITY,
  POWERUP_CHANCE,
  LEVEL_CONFIGS,
} from './constants';

// --- HELPER FUNCTIONS ---

const generateLevel = (level: number): { board: Tile[][], enemies: Enemy[] } => {
  const board: Tile[][] = Array(GRID_HEIGHT).fill(0).map(() => Array(GRID_WIDTH).fill(Tile.FLOOR));
  const enemyCount = LEVEL_CONFIGS[level - 1]?.enemies || 3;

  // Create walls
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1 || (x % 2 === 0 && y % 2 === 0)) {
        board[y][x] = Tile.WALL;
      }
    }
  }

  const cratePositions: Position[] = [];
  // Place crates
  for (let y = 1; y < GRID_HEIGHT - 1; y++) {
    for (let x = 1; x < GRID_WIDTH - 1; x++) {
      if (board[y][x] === Tile.FLOOR && Math.random() < CRATE_DENSITY) {
        // Exclude player start area
        if (!((x <= 2 && y === 1) || (x === 1 && y <= 2))) {
          board[y][x] = Tile.CRATE;
          cratePositions.push({ x, y });
        }
      }
    }
  }
  
  // Hide exit under a random crate
  if (cratePositions.length > 0) {
    const exitCrateIndex = Math.floor(Math.random() * cratePositions.length);
    const pos = cratePositions.splice(exitCrateIndex, 1)[0];
    board[pos.y][pos.x] = Tile.EXIT; // Internally it's an exit, but it's hidden
  }

  // Hide powerups under random crates
  cratePositions.forEach(pos => {
      if (Math.random() < POWERUP_CHANCE) {
          const powerupType = Math.random();
          if (powerupType < 0.33) board[pos.y][pos.x] = Tile.POWERUP_BOMB;
          else if (powerupType < 0.66) board[pos.y][pos.x] = Tile.POWERUP_RANGE;
          else board[pos.y][pos.x] = Tile.POWERUP_SPEED;
      }
  });


  const enemies: Enemy[] = [];
  for (let i = 0; i < enemyCount; i++) {
    let placed = false;
    while (!placed) {
      const x = Math.floor(Math.random() * (GRID_WIDTH - 2)) + 1;
      const y = Math.floor(Math.random() * (GRID_HEIGHT - 2)) + 1;
      if (board[y][x] === Tile.FLOOR && x > 5 && y > 5) {
        enemies.push({ id: Date.now() + i, x, y, direction: ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)] as 'up' | 'down' | 'left' | 'right' });
        placed = true;
      }
    }
  }

  return { board, enemies };
};


const initialState: GameState = {
  board: [],
  player: {
    ...PLAYER_START_POS,
    bombsMax: PLAYER_START_BOMBS,
    bombsLeft: PLAYER_START_BOMBS,
    range: PLAYER_START_RANGE,
    speed: PLAYER_START_SPEED,
    isAlive: true,
  },
  enemies: [],
  bombs: [],
  explosions: [],
  gameStatus: 'START_MENU',
  level: 1,
  score: 0,
};

const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'START_GAME': {
      const { board, enemies } = generateLevel(1);
      return {
        ...initialState,
        board,
        enemies,
        gameStatus: 'PLAYING',
        level: 1,
        score: 0
      };
    }
    case 'NEXT_LEVEL': {
        const nextLevel = state.level + 1;
        if(nextLevel > LEVEL_CONFIGS.length) {
            return { ...state, gameStatus: 'WON' };
        }
        const { board, enemies } = generateLevel(nextLevel);
        return {
            ...state,
            level: nextLevel,
            board,
            enemies,
            player: { ...state.player, ...PLAYER_START_POS },
            bombs: [],
            explosions: [],
            gameStatus: 'PLAYING',
        }
    }
    case 'RESET_GAME': {
      return { ...initialState };
    }
    case 'MOVE': {
      if (state.gameStatus !== 'PLAYING' || !state.player.isAlive) return state;
      const { dx, dy } = action;
      const { x, y, speed } = state.player;
      const newX = x + dx * speed;
      const newY = y + dy * speed;
      
      const gridX = Math.round(newX);
      const gridY = Math.round(newY);

      // Simple collision detection
      const canMove = (posX: number, posY: number) => {
          const tile = state.board[Math.round(posY)]?.[Math.round(posX)];
          return tile !== undefined && tile !== Tile.WALL && tile !== Tile.CRATE;
      };

      if (canMove(newX, newY)) {
        let newPlayer = { ...state.player, x: newX, y: newY };
        let newBoard = state.board;

        const currentTile = state.board[gridY][gridX];
        if(currentTile > Tile.EXPLOSION) {
            newBoard = state.board.map(row => [...row]);
            newBoard[gridY][gridX] = Tile.FLOOR;
            if(currentTile === Tile.POWERUP_BOMB) newPlayer.bombsMax++;
            if(currentTile === Tile.POWERUP_RANGE) newPlayer.range++;
            if(currentTile === Tile.POWERUP_SPEED) newPlayer.speed *= 1.2;
            if(currentTile === Tile.EXIT && state.enemies.length === 0) {
              return gameReducer({...state, player: newPlayer, board: newBoard}, {type: 'NEXT_LEVEL'});
            }
        }
        newPlayer.bombsLeft = newPlayer.bombsMax - state.bombs.length;

        return { ...state, player: newPlayer, board: newBoard };
      }

      return state;
    }
    case 'PLACE_BOMB': {
      if (state.gameStatus !== 'PLAYING' || !state.player.isAlive || state.player.bombsLeft <= 0) return state;
      const { x, y, range } = state.player;
      const gridX = Math.round(x);
      const gridY = Math.round(y);

      // Prevent placing bomb on another bomb
      if (state.bombs.some(b => b.x === gridX && b.y === gridY)) {
        return state;
      }
      
      // FIX: Add a unique id to the bomb for tracking in chain reactions.
      const newBombs = [...state.bombs, { id: Date.now(), x: gridX, y: gridY, timer: BOMB_TIMER, range }];
      const newPlayer = { ...state.player, bombsLeft: state.player.bombsLeft - 1 };
      
      return { ...state, bombs: newBombs, player: newPlayer };
    }
    case 'TICK': {
      if (state.gameStatus !== 'PLAYING') return state;
      let newState = { ...state };
      let newBoard = newState.board.map(row => [...row]);
      let newExplosions: Explosion[] = [];
      let triggeredBombs: Bomb[] = [];

      // Update bomb timers
      const remainingBombs = newState.bombs.map(bomb => ({ ...bomb, timer: bomb.timer - 1 }));
      triggeredBombs = remainingBombs.filter(bomb => bomb.timer <= 0);
      newState.bombs = remainingBombs.filter(bomb => bomb.timer > 0);

      // Handle explosions
      triggeredBombs.forEach(bomb => {
        newExplosions.push({ x: bomb.x, y: bomb.y, timer: EXPLOSION_TIMER });
        newBoard[bomb.y][bomb.x] = Tile.EXPLOSION;
        
        const directions = [{dx:0, dy:1}, {dx:0, dy:-1}, {dx:1, dy:0}, {dx:-1, dy:0}];
        for(const dir of directions) {
            for(let i = 1; i <= bomb.range; i++) {
                const nx = bomb.x + dir.dx * i;
                const ny = bomb.y + dir.dy * i;
                if (nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT || newBoard[ny][nx] === Tile.WALL) break;
                
                const existingBomb = newState.bombs.find(b => b.x === nx && b.y === ny);
                if(existingBomb) {
                    triggeredBombs.push(existingBomb);
                    newState.bombs = newState.bombs.filter(b => b.id !== existingBomb.id);
                }

                newExplosions.push({ x: nx, y: ny, timer: EXPLOSION_TIMER });
                if(newBoard[ny][nx] === Tile.CRATE) {
                    newBoard[ny][nx] = Tile.FLOOR; // Destroy crate
                    break;
                }
                 const hiddenTile = state.board[ny][nx];
                 if (hiddenTile >= Tile.POWERUP_BOMB) {
                    newBoard[ny][nx] = hiddenTile; // Reveal powerup/exit
                    break;
                }
            }
        }
      });
      newState.explosions = [...newState.explosions, ...newExplosions];
      
      // Update explosion timers and clear them
      newState.explosions = newState.explosions.map(exp => ({...exp, timer: exp.timer - 1}));
      const finishedExplosions = newState.explosions.filter(exp => exp.timer <= 0);
      finishedExplosions.forEach(exp => {
        if(newBoard[exp.y][exp.x] === Tile.EXPLOSION) {
            newBoard[exp.y][exp.x] = Tile.FLOOR;
        }
      });
      newState.explosions = newState.explosions.filter(exp => exp.timer > 0);

      // Move enemies
      newState.enemies = newState.enemies.map(enemy => {
        const { x, y, direction } = enemy;
        let { dx, dy } = { up: {dx:0, dy:-1}, down: {dx:0, dy:1}, left: {dx:-1, dy:0}, right: {dx:1, dy:0} }[direction];
        const newX = x + dx * ENEMY_START_SPEED;
        const newY = y + dy * ENEMY_START_SPEED;
        const gridX = Math.round(newX);
        const gridY = Math.round(newY);

        if (newBoard[gridY]?.[gridX] === Tile.WALL || newBoard[gridY]?.[gridX] === Tile.CRATE) {
          const directions: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];
          return { ...enemy, direction: directions[Math.floor(Math.random() * 4)] };
        }
        return { ...enemy, x: newX, y: newY };
      });
      
      // Collision checks
      let playerAlive = newState.player.isAlive;
      let remainingEnemies = [...newState.enemies];
      let score = newState.score;

      // Player vs explosion/enemy
      const playerGridX = Math.round(newState.player.x);
      const playerGridY = Math.round(newState.player.y);
      if (newState.explosions.some(exp => exp.x === playerGridX && exp.y === playerGridY)) {
        playerAlive = false;
      }
      if (newState.enemies.some(enemy => Math.round(enemy.x) === playerGridX && Math.round(enemy.y) === playerGridY)) {
        playerAlive = false;
      }
      
      // Enemy vs explosion
      const killedEnemies = new Set();
      newState.explosions.forEach(exp => {
          remainingEnemies.forEach(enemy => {
              if (Math.round(enemy.x) === exp.x && Math.round(enemy.y) === exp.y) {
                  killedEnemies.add(enemy.id);
              }
          })
      });
      if(killedEnemies.size > 0) {
        score += killedEnemies.size * 100;
        remainingEnemies = remainingEnemies.filter(e => !killedEnemies.has(e.id));
      }

      newState.player = { ...newState.player, isAlive: playerAlive };
      newState.enemies = remainingEnemies;
      newState.board = newBoard;
      newState.score = score;
      
      if (!playerAlive) {
        newState.gameStatus = 'LOST';
      }

      return newState;
    }
    default:
      return state;
  }
};


// --- COMPONENTS ---

const TileComponent: React.FC<{ tile: Tile }> = React.memo(({ tile }) => {
  const baseClasses = 'w-full h-full';
  switch (tile) {
    case Tile.FLOOR:
      return <div className={`${baseClasses} bg-green-700`}></div>;
    case Tile.WALL:
      return <div className={`${baseClasses} bg-gray-600 border-2 border-gray-700`}></div>;
    case Tile.CRATE:
      return <div className={`${baseClasses} bg-yellow-700 border-2 border-yellow-800`}></div>;
    case Tile.POWERUP_BOMB:
    case Tile.POWERUP_RANGE:
    case Tile.POWERUP_SPEED:
    case Tile.EXIT:
       return <div className={`${baseClasses} bg-yellow-700 border-2 border-yellow-800`}></div>; // Hidden initially
    default:
      return <div className={`${baseClasses} bg-green-700`}></div>;
  }
});

const RevealedTileComponent: React.FC<{ tile: Tile }> = React.memo(({ tile }) => {
    const baseClasses = 'w-full h-full flex items-center justify-center text-white text-lg font-bold';
    switch (tile) {
      case Tile.POWERUP_BOMB:
        return <div className={`${baseClasses} bg-green-700`} title="More Bombs">💣</div>;
      case Tile.POWERUP_RANGE:
        return <div className={`${baseClasses} bg-green-700`} title="Bigger Blast">🔥</div>;
      case Tile.POWERUP_SPEED:
        return <div className={`${baseClasses} bg-green-700`} title="Faster Speed">👟</div>;
      case Tile.EXIT:
        return <div className={`${baseClasses} bg-blue-500 animate-pulse`} title="Exit">🚪</div>;
      default:
        return <div className={`${baseClasses} bg-green-700`}></div>;
    }
});


const PlayerComponent: React.FC<{ player: Player }> = ({ player }) => {
  return (
    <div
      className="absolute bg-white rounded-full border-2 border-blue-400"
      style={{
        left: player.x * TILE_SIZE,
        top: player.y * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
        transition: 'left 50ms linear, top 50ms linear',
      }}
    >
        <div className="w-full h-full flex items-center justify-center text-xl">😃</div>
    </div>
  );
};

const EnemyComponent: React.FC<{ enemy: Enemy }> = ({ enemy }) => {
  return (
    <div
      className="absolute bg-red-500 rounded-full"
      style={{
        left: enemy.x * TILE_SIZE,
        top: enemy.y * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
        transition: 'left 50ms linear, top 50ms linear',
      }}
    >
        <div className="w-full h-full flex items-center justify-center text-xl">😠</div>
    </div>
  );
};

const BombComponent: React.FC<{ bomb: Bomb }> = ({ bomb }) => {
    const scale = 1 - (bomb.timer % 30) / 60;
  return (
    <div
      className="absolute bg-gray-800 rounded-full border-2 border-red-500 flex items-center justify-center"
      style={{
        left: bomb.x * TILE_SIZE,
        top: bomb.y * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
        transform: `scale(${scale})`,
      }}
    >
        <div className="text-red-500 text-sm animate-ping">!</div>
    </div>
  );
};

const ExplosionComponent: React.FC<{ explosion: Explosion }> = ({ explosion }) => {
  const opacity = explosion.timer / EXPLOSION_TIMER;
  return (
    <div
      className="absolute bg-orange-500 rounded-md"
      style={{
        left: explosion.x * TILE_SIZE,
        top: explosion.y * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
        opacity: opacity,
      }}
    />
  );
};

const GameOverlay: React.FC<{ status: GameStatus; onRestart: () => void; onNextLevel?: () => void; level: number; score: number }> = ({ status, onRestart, onNextLevel, level, score }) => {
  if (status === 'PLAYING' || status === 'START_MENU') return null;
  const isWin = status === 'WON';
  const message = isWin ? "YOU WIN!" : "GAME OVER";
  const finalLevel = isWin ? LEVEL_CONFIGS.length : level;

  return (
    <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center text-white z-50">
      <h2 className="text-6xl mb-4" style={{ textShadow: '4px 4px #ff0000' }}>{message}</h2>
      <p className="text-2xl mb-2">Final Score: {score}</p>
      <p className="text-xl mb-6">You reached level {finalLevel}</p>
      <button
        onClick={onRestart}
        className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-2xl rounded-lg border-2 border-white shadow-lg"
      >
        Play Again
      </button>
    </div>
  );
};

const StartMenu: React.FC<{ onStart: () => void }> = ({ onStart }) => {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800">
            <h1 className="text-6xl text-yellow-400 mb-4" style={{ textShadow: '3px 3px #000' }}>Blast & Dash</h1>
            <p className="text-lg text-gray-300 mb-8">Defeat all enemies and find the exit!</p>
            <div className="text-left bg-gray-900 p-6 rounded-lg border-2 border-gray-600">
                <h3 className="text-2xl mb-4 text-center">Controls</h3>
                <p><span className="text-yellow-400">Arrow Keys</span> or <span className="text-yellow-400">WASD</span>: Move</p>
                <p><span className="text-yellow-400">Spacebar</span>: Place Bomb</p>
            </div>
             <button
                onClick={onStart}
                className="mt-12 px-10 py-5 bg-green-600 hover:bg-green-700 text-white text-3xl rounded-lg border-2 border-white shadow-lg animate-pulse"
             >
                Start Game
            </button>
        </div>
    );
};


const App: React.FC = () => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const { board, player, enemies, bombs, explosions, gameStatus, level, score } = state;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (gameStatus !== 'PLAYING') return;
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
        dispatch({ type: 'MOVE', dx: 0, dy: -1 });
        break;
      case 'ArrowDown':
      case 's':
        dispatch({ type: 'MOVE', dx: 0, dy: 1 });
        break;
      case 'ArrowLeft':
      case 'a':
        dispatch({ type: 'MOVE', dx: -1, dy: 0 });
        break;
      case 'ArrowRight':
      case 'd':
        dispatch({ type: 'MOVE', dx: 1, dy: 0 });
        break;
      case ' ': // Spacebar
        e.preventDefault();
        dispatch({ type: 'PLACE_BOMB' });
        break;
    }
  }, [gameStatus]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    if (gameStatus !== 'PLAYING') return;
    const gameLoop = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, 1000 / 60);
    return () => clearInterval(gameLoop);
  }, [gameStatus]);


  const boardWidth = GRID_WIDTH * TILE_SIZE;
  const boardHeight = GRID_HEIGHT * TILE_SIZE;

  if (gameStatus === 'START_MENU') {
      return (
          <div className="w-screen h-screen flex items-center justify-center">
              <StartMenu onStart={() => dispatch({type: 'START_GAME'})} />
          </div>
      );
  }

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-center p-4 bg-gray-900">
        <div className="flex justify-between w-full max-w-4xl mb-2 text-xl">
            <span>Level: {level}</span>
            <span>Score: {score}</span>
            <span>Enemies: {enemies.length}</span>
        </div>
        <div
            className="relative bg-gray-800 border-4 border-gray-600"
            style={{ width: boardWidth, height: boardHeight }}
        >
            <GameOverlay status={gameStatus} onRestart={() => dispatch({type: 'RESET_GAME'})} level={level} score={score}/>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${GRID_WIDTH}, 1fr)` }}>
                {board.map((row, y) =>
                row.map((tile, x) => (
                    <div key={`${x}-${y}`} style={{ width: TILE_SIZE, height: TILE_SIZE }} className="relative">
                        <TileComponent tile={tile} />
                        {(tile >= Tile.POWERUP_BOMB) && board[y][x] !== Tile.CRATE && <RevealedTileComponent tile={board[y][x]}/>}
                    </div>
                ))
                )}
            </div>

            {bombs.map((bomb, i) => <BombComponent key={i} bomb={bomb} />)}
            {explosions.map((exp, i) => <ExplosionComponent key={i} explosion={exp} />)}
            {player.isAlive && <PlayerComponent player={player} />}
            {enemies.map(enemy => <EnemyComponent key={enemy.id} enemy={enemy} />)}
        </div>
        <div className="mt-4 text-gray-400 text-sm">Use Arrow Keys/WASD to Move, Space to Drop Bomb</div>
    </div>
  );
};

export default App;
