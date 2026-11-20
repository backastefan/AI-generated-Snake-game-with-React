import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { synthEngine } from '../audio/synthEngine';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
type SpeedTier = 'chill' | 'arcade' | 'turbo';

interface Point {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface TrailNode {
  x: number;
  y: number;
  life: number;
}

interface BonusOrb {
  x: number;
  y: number;
  expiresAt: number;
}

interface SnakeArenaProps {
  isMusicPlaying: boolean;
  trackAccentHex: string;
  onStartGameAudio: () => void;
}

const GRID_SIZE = 20;
const HIGH_SCORE_KEY = 'synthsnake_high_score_v1';

const SPEED_MS: Record<SpeedTier, number> = {
  chill: 95,
  arcade: 70,
  turbo: 50,
};

const SPEED_LABELS: Record<SpeedTier, string> = {
  chill: 'SLOW',
  arcade: 'STD',
  turbo: 'OVER',
};

const INITIAL_SNAKE: Point[] = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
];

const INITIAL_DIR: Point = { x: 1, y: 0 };

function randomFreeCell(occupied: Point[]): Point {
  const occupiedSet = new Set(occupied.map((p) => `${p.x},${p.y}`));
  const candidates: Point[] = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      if (!occupiedSet.has(`${x},${y}`)) {
        candidates.push({ x, y });
      }
    }
  }
  if (candidates.length === 0) return { x: 0, y: 0 };
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export default function SnakeArena({
  isMusicPlaying,
  trackAccentHex,
  onStartGameAudio,
}: SnakeArenaProps) {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(HIGH_SCORE_KEY);
      return saved ? Math.max(0, Number(saved) || 0) : 0;
    } catch {
      return 0;
    }
  });
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [snakeLength, setSnakeLength] = useState(INITIAL_SNAKE.length);
  const [foodCount, setFoodCount] = useState(0);
  const [speedTier, setSpeedTier] = useState<SpeedTier>('arcade');
  const [wrapWalls, setWrapWalls] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snakeRef = useRef<Point[]>([...INITIAL_SNAKE]);
  const prevSnakeRef = useRef<Point[]>([...INITIAL_SNAKE]);
  const lastStepTimeRef = useRef<number>(performance.now());
  const stepDelayRef = useRef<number>(SPEED_MS.arcade);
  const dirRef = useRef<Point>({ ...INITIAL_DIR });
  const turnQueueRef = useRef<Point[]>([]);
  const foodRef = useRef<Point>({ x: 15, y: 10 });
  const bonusRef = useRef<BonusOrb | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const trailRef = useRef<TrailNode[]>([]);
  const scoreRef = useRef(0);
  const highScoreRef = useRef(highScore);
  const gameStateRef = useRef<GameState>('TITLE_MENU');
  const shakeRef = useRef(0);

  useEffect(() => {
    highScoreRef.current = highScore;
  }, [highScore]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const handleToggleSfx = () => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    synthEngine.setSfxEnabled(next);
  };

  const spawnParticles = (gridX: number, gridY: number, color: string, count = 14) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = 0.06 + Math.random() * 0.14;
      particlesRef.current.push({
        x: gridX + 0.5,
        y: gridY + 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
      });
    }
  };

  const startNewGame = useCallback(() => {
    const freshSnake = INITIAL_SNAKE.map((p) => ({ ...p }));
    snakeRef.current = freshSnake;
    prevSnakeRef.current = freshSnake.map((p) => ({ ...p }));
    lastStepTimeRef.current = performance.now();
    stepDelayRef.current = SPEED_MS[speedTier];
    dirRef.current = { ...INITIAL_DIR };
    turnQueueRef.current = [];
    foodRef.current = randomFreeCell(freshSnake);
    bonusRef.current = null;
    particlesRef.current = [];
    trailRef.current = [];
    scoreRef.current = 0;
    shakeRef.current = 0;

    setScore(0);
    setSnakeLength(freshSnake.length);
    setFoodCount(0);
    setIsNewRecord(false);
    setGameState('PLAYING');

    synthEngine.playStartSound();
    onStartGameAudio();
  }, [onStartGameAudio, speedTier]);

  const togglePause = useCallback(() => {
    if (gameStateRef.current === 'PLAYING') {
      setGameState('PAUSED');
    } else if (gameStateRef.current === 'PAUSED') {
      setGameState('PLAYING');
    } else if (gameStateRef.current === 'TITLE_MENU' || gameStateRef.current === 'GAME_OVER') {
      startNewGame();
    }
  }, [startNewGame]);

  const queueDirection = useCallback((nextDir: Point) => {
    if (gameStateRef.current !== 'PLAYING') return;

    const queue = turnQueueRef.current;
    const referenceDir = queue.length > 0 ? queue[queue.length - 1] : dirRef.current;

    if (
      (nextDir.x === referenceDir.x && nextDir.y === referenceDir.y) ||
      (nextDir.x === -referenceDir.x && nextDir.y === -referenceDir.y)
    ) {
      return;
    }

    if (queue.length < 2) {
      queue.push(nextDir);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          queueDirection({ x: 0, y: -1 });
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          queueDirection({ x: 0, y: 1 });
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          queueDirection({ x: -1, y: 0 });
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          queueDirection({ x: 1, y: 0 });
          break;
        case ' ':
          e.preventDefault();
          togglePause();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queueDirection, togglePause]);

  // Game Logic Tick
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const baseDelay = SPEED_MS[speedTier];
    const dynamicDelay = Math.max(38, baseDelay - Math.floor(foodCount / 4) * 3);
    stepDelayRef.current = dynamicDelay;
    lastStepTimeRef.current = performance.now();

    const timer = window.setInterval(() => {
      const snake = snakeRef.current;
      if (turnQueueRef.current.length > 0) {
        dirRef.current = turnQueueRef.current.shift()!;
      }

      const dir = dirRef.current;
      let nextX = snake[0].x + dir.x;
      let nextY = snake[0].y + dir.y;

      if (wrapWalls) {
        nextX = (nextX + GRID_SIZE) % GRID_SIZE;
        nextY = (nextY + GRID_SIZE) % GRID_SIZE;
      } else if (nextX < 0 || nextX >= GRID_SIZE || nextY < 0 || nextY >= GRID_SIZE) {
        shakeRef.current = 10;
        synthEngine.playGameOverSound();
        setGameState('GAME_OVER');
        return;
      }

      const willEatFood = nextX === foodRef.current.x && nextY === foodRef.current.y;
      const bodyToCheck = willEatFood ? snake : snake.slice(0, -1);

      const hitSelf = bodyToCheck.some((seg) => seg.x === nextX && seg.y === nextY);
      if (hitSelf) {
        shakeRef.current = 10;
        synthEngine.playGameOverSound();
        setGameState('GAME_OVER');
        return;
      }

      prevSnakeRef.current = snake.map((p) => ({ ...p }));
      lastStepTimeRef.current = performance.now();

      const oldTail = snake[snake.length - 1];
      if (!willEatFood && oldTail) {
        trailRef.current.push({
          x: oldTail.x,
          y: oldTail.y,
          life: 1,
        });
        if (Math.random() < 0.8) {
          particlesRef.current.push({
            x: oldTail.x + 0.5 + (Math.random() - 0.5) * 0.25,
            y: oldTail.y + 0.5 + (Math.random() - 0.5) * 0.25,
            vx: (Math.random() - 0.5) * 0.04,
            vy: (Math.random() - 0.5) * 0.04,
            life: 0.78,
            color: Math.random() > 0.45 ? '#FF00FF' : '#00FFFF',
          });
        }
      }

      const nextHead = { x: nextX, y: nextY };
      const nextSnake = [nextHead, ...snake];
      if (!willEatFood) {
        nextSnake.pop();
      }
      snakeRef.current = nextSnake;

      if (bonusRef.current && Date.now() > bonusRef.current.expiresAt) {
        bonusRef.current = null;
      }

      if (
        bonusRef.current &&
        nextX === bonusRef.current.x &&
        nextY === bonusRef.current.y
      ) {
        spawnParticles(bonusRef.current.x, bonusRef.current.y, '#00FFFF', 20);
        bonusRef.current = null;
        scoreRef.current += 30;
        setScore(scoreRef.current);
        synthEngine.playBonusSound();

        if (scoreRef.current > highScoreRef.current) {
          highScoreRef.current = scoreRef.current;
          setHighScore(scoreRef.current);
          setIsNewRecord(true);
          try {
            localStorage.setItem(HIGH_SCORE_KEY, String(scoreRef.current));
          } catch {
            // Ignore storage quota errors
          }
        }
      }

      if (willEatFood) {
        spawnParticles(foodRef.current.x, foodRef.current.y, '#FF00FF', 16);
        scoreRef.current += 10;
        setScore(scoreRef.current);
        setSnakeLength(nextSnake.length);
        setFoodCount((c) => {
          const nextCount = c + 1;
          if (nextCount % 5 === 0 && !bonusRef.current) {
            const occupied = [...nextSnake, foodRef.current];
            const bonusPos = randomFreeCell(occupied);
            bonusRef.current = {
              ...bonusPos,
              expiresAt: Date.now() + 7000,
            };
          }
          return nextCount;
        });

        synthEngine.playEatSound();

        const occupied = bonusRef.current
          ? [...nextSnake, { x: bonusRef.current.x, y: bonusRef.current.y }]
          : nextSnake;
        foodRef.current = randomFreeCell(occupied);

        if (scoreRef.current > highScoreRef.current) {
          highScoreRef.current = scoreRef.current;
          setHighScore(scoreRef.current);
          setIsNewRecord(true);
          try {
            localStorage.setItem(HIGH_SCORE_KEY, String(scoreRef.current));
          } catch {
            // Ignore storage quota errors
          }
        }
      }
    }, dynamicDelay);

    return () => clearInterval(timer);
  }, [gameState, speedTier, wrapWalls, foodCount]);

  // 60fps Pixel Glitch Art Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const draw = (timeMs: number) => {
      const dpr = window.devicePixelRatio || 1;
      const size = canvas.clientWidth;
      if (size > 0 && (canvas.width !== Math.floor(size * dpr) || canvas.height !== Math.floor(size * dpr))) {
        canvas.width = Math.floor(size * dpr);
        canvas.height = Math.floor(size * dpr);
      }

      const cell = size / GRID_SIZE;
      const freq = synthEngine.getFrequencyData();
      const bassEnergy = isMusicPlaying ? ((freq[1] ?? 0) + (freq[2] ?? 0)) / 510 : 0;

      ctx.save();
      ctx.scale(dpr, dpr);

      if (shakeRef.current > 0.2) {
        const dx = (Math.random() - 0.5) * shakeRef.current;
        const dy = (Math.random() - 0.5) * shakeRef.current;
        ctx.translate(dx, dy);
        shakeRef.current *= 0.84;
      } else {
        shakeRef.current = 0;
      }

      // Pitch black arena floor
      ctx.fillStyle = '#020205';
      ctx.fillRect(0, 0, size, size);

      // Subtle audio-reactive Cyan/Magenta grid pulse
      if (bassEnergy > 0.05) {
        ctx.fillStyle = `rgba(255, 0, 255, ${0.04 * bassEnergy})`;
        ctx.fillRect(0, 0, size, size);
      }

      // Raw Pixel Grid Lines
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < GRID_SIZE; i++) {
        const pos = Math.round(i * cell) + 0.5;
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, size);
        ctx.moveTo(0, pos);
        ctx.lineTo(size, pos);
      }
      ctx.stroke();

      // Occasional horizontal glitch tear artifact on canvas when music plays
      if (isMusicPlaying && Math.random() < 0.035) {
        const tearY = Math.floor(Math.random() * size);
        const tearH = 2 + Math.floor(Math.random() * 4);
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,255,255,0.14)' : 'rgba(255,0,255,0.14)';
        ctx.fillRect(0, tearY, size, tearH);
      }

      // Food Target (Sharp Magenta Pixel Square with Cyan Core)
      const food = foodRef.current;
      const pulse = 0.85 + Math.sin(timeMs * 0.009) * 0.15;
      const fSize = cell * 0.68 * pulse;
      const fx = (food.x + 0.5) * cell - fSize / 2;
      const fy = (food.y + 0.5) * cell - fSize / 2;

      ctx.save();
      ctx.shadowColor = '#FF00FF';
      ctx.shadowBlur = 14 + bassEnergy * 10;
      ctx.fillStyle = '#FF00FF';
      ctx.fillRect(fx, fy, fSize, fSize);

      const coreSize = fSize * 0.4;
      ctx.fillStyle = '#00FFFF';
      ctx.fillRect(
        (food.x + 0.5) * cell - coreSize / 2,
        (food.y + 0.5) * cell - coreSize / 2,
        coreSize,
        coreSize
      );
      ctx.restore();

      // Bonus Node (Flashing Cyan/Magenta Frame)
      const bonus = bonusRef.current;
      if (bonus) {
        const remainingRatio = Math.max(0, (bonus.expiresAt - Date.now()) / 7000);
        const bx = bonus.x * cell + cell * 0.15;
        const by = bonus.y * cell + cell * 0.15;
        const bSize = cell * 0.7;

        ctx.save();
        ctx.shadowColor = '#00FFFF';
        ctx.shadowBlur = 16;
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bSize, bSize);

        ctx.fillStyle = '#FF00FF';
        ctx.fillRect(
          bx + bSize * 0.25,
          by + bSize * 0.25,
          bSize * 0.5,
          bSize * 0.5 * remainingRatio + bSize * 0.1
        );
        ctx.restore();
      }

      // Glowing Cyan/Magenta Tail Trail
      const isActivelyPlaying = gameStateRef.current === 'PLAYING';
      const activeTrail: TrailNode[] = [];
      for (const node of trailRef.current) {
        if (isActivelyPlaying) {
          node.life -= 0.042;
        }
        if (node.life > 0.02) {
          activeTrail.push(node);
          const scale = 0.28 + node.life * 0.46;
          const pad = (cell * (1 - scale)) / 2;
          const tx = node.x * cell + pad;
          const ty = node.y * cell + pad;
          const tw = cell - pad * 2;

          ctx.save();
          ctx.globalAlpha = node.life * 0.65;
          ctx.shadowColor = node.life > 0.5 ? '#FF00FF' : '#00FFFF';
          ctx.shadowBlur = 16 * node.life;
          ctx.fillStyle = node.life > 0.5 ? '#FF00FF' : '#00FFFF';
          ctx.fillRect(tx, ty, tw, tw);
          ctx.restore();
        }
      }
      trailRef.current = activeTrail;

      // Snake Body (60fps Sub-cell Interpolated Brutalist Pixel Blocks)
      const snake = snakeRef.current;
      const prevSnake = prevSnakeRef.current;
      const interp = isActivelyPlaying
        ? Math.min(1, (performance.now() - lastStepTimeRef.current) / Math.max(1, stepDelayRef.current))
        : 1;

      const getVisualPos = (index: number): Point => {
        const curr = snake[index];
        const prev = prevSnake[index] ?? prevSnake[prevSnake.length - 1] ?? curr;
        if (Math.abs(curr.x - prev.x) > 1 || Math.abs(curr.y - prev.y) > 1) {
          return curr;
        }
        return {
          x: prev.x + (curr.x - prev.x) * interp,
          y: prev.y + (curr.y - prev.y) * interp,
        };
      };

      for (let i = snake.length - 1; i >= 0; i--) {
        const vis = getVisualPos(i);
        const isHead = i === 0;
        const t = i / Math.max(1, snake.length - 1);
        const pad = isHead ? cell * 0.06 : cell * (0.09 + t * 0.08);
        const rx = vis.x * cell + pad;
        const ry = vis.y * cell + pad;
        const rw = cell - pad * 2;
        const rh = cell - pad * 2;

        ctx.save();
        if (isHead) {
          ctx.shadowColor = trackAccentHex || '#00FFFF';
          ctx.shadowBlur = 18;
          ctx.fillStyle = '#00FFFF';
          ctx.fillRect(rx, ry, rw, rh);
          // Chromatic magenta pixel rim on head
          ctx.strokeStyle = '#FF00FF';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(rx, ry, rw, rh);
        } else {
          // Alternating Cyan vs. Magenta glitch segments
          const isMagentaSeg = i % 2 === 1;
          ctx.shadowColor = isMagentaSeg ? '#FF00FF' : '#00FFFF';
          ctx.shadowBlur = 8;
          ctx.fillStyle = isMagentaSeg
            ? `rgba(255, 0, 255, ${0.92 - t * 0.35})`
            : `rgba(0, 255, 255, ${0.92 - t * 0.35})`;
          ctx.fillRect(rx, ry, rw, rh);
        }
        ctx.restore();

        if (isHead) {
          const d = dirRef.current;
          const cx = vis.x * cell + cell / 2;
          const cy = vis.y * cell + cell / 2;
          const eyeOffsetForward = cell * 0.16;
          const eyeOffsetSide = cell * 0.16;
          const eyeSize = Math.max(3, cell * 0.14);

          const ex1 = cx + d.x * eyeOffsetForward - d.y * eyeOffsetSide - eyeSize / 2;
          const ey1 = cy + d.y * eyeOffsetForward + d.x * eyeOffsetSide - eyeSize / 2;
          const ex2 = cx + d.x * eyeOffsetForward + d.y * eyeOffsetSide - eyeSize / 2;
          const ey2 = cy + d.y * eyeOffsetForward - d.x * eyeOffsetSide - eyeSize / 2;

          ctx.fillStyle = '#020204';
          ctx.fillRect(ex1, ey1, eyeSize, eyeSize);
          ctx.fillRect(ex2, ey2, eyeSize, eyeSize);
        }
      }

      // Square Pixel Particles
      const activeParticles: Particle[] = [];
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.045;
        if (p.life > 0) {
          activeParticles.push(p);
          const pSize = Math.max(2, cell * 0.16 * p.life);
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x * cell - pSize / 2, p.y * cell - pSize / 2, pSize, pSize);
          ctx.restore();
        }
      }
      particlesRef.current = activeParticles;

      ctx.restore();
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [isMusicPlaying, trackAccentHex]);

  return (
    <section
      id="arcade-section"
      aria-label="Serpent Execution Arena"
      className="flex flex-1 flex-col items-center justify-between bg-[#06060A] border-2 border-[#00FFFF] shadow-[6px_6px_0_#FF00FF] p-4 sm:p-5"
    >
      {/* Top Score & Speed HUD */}
      <div className="w-full max-w-[540px] flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b-2 border-[#FF00FF]/45">
        <div className="flex items-center gap-5 sm:gap-7">
          <div>
            <span className="block text-[10px] tracking-wider text-[#FF00FF]">
              SCORE
            </span>
            <span
              data-text={String(score)}
              className="glitch-text font-mono text-4xl sm:text-5xl text-[#00FFFF] tabular-nums leading-none"
            >
              {score}
            </span>
          </div>

          <div className="h-10 w-[2px] bg-[#FF00FF]/45" aria-hidden="true" />

          <div>
            <span className="block text-[10px] tracking-wider text-[#00FFFF]">
              PEAK
            </span>
            <span
              data-text={String(highScore)}
              className="glitch-text font-mono text-4xl sm:text-5xl text-[#E6FFFF] tabular-nums leading-none"
            >
              {highScore}
            </span>
          </div>

          <div className="hidden sm:block h-10 w-[2px] bg-[#00FFFF]/45" aria-hidden="true" />

          <div className="hidden sm:block">
            <span className="block text-[10px] tracking-wider text-[#FF00FF]">
              NODES
            </span>
            <span
              data-text={String(snakeLength)}
              className="glitch-text font-mono text-4xl sm:text-5xl text-[#00FFFF] tabular-nums leading-none"
            >
              {snakeLength}
            </span>
          </div>
        </div>

        {/* Speed Segmented Control */}
        <div
          className="flex items-center gap-1 bg-black p-1 border-2 border-[#00FFFF]/60"
          role="group"
          aria-label="Clock speed"
        >
          {(['chill', 'arcade', 'turbo'] as SpeedTier[]).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setSpeedTier(tier)}
              className={`px-2.5 py-1.5 text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF] ${
                speedTier === tier
                  ? 'bg-[#FF00FF] text-black'
                  : 'text-[#00FFFF] hover:bg-[#00FFFF]/15'
              }`}
            >
              {SPEED_LABELS[tier]}
            </button>
          ))}
        </div>
      </div>

      {/* Center Canvas Window */}
      <div className="relative mt-4 w-full max-w-[540px] aspect-square overflow-hidden border-2 border-[#FF00FF] bg-[#020205] shadow-[4px_4px_0_#00FFFF]">
        <canvas
          ref={canvasRef}
          className="h-full w-full block"
          aria-label="Snake execution grid"
        />

        {/* Subtle CRT Scanlines over Canvas */}
        <div className="pointer-events-none absolute inset-0 crt-scanlines opacity-55" />

        {/* TITLE MENU OVERLAY */}
        {gameState === 'TITLE_MENU' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020204]/88 p-6 text-center">
            <h1
              data-text="SERPENT.EXE"
              className="glitch-text screen-tear font-display text-2xl sm:text-3xl text-[#00FFFF] tracking-wider"
            >
              SERPENT.EXE
            </h1>
            <p className="mt-3 max-w-xs text-xs text-[#E6FFFF]/85 leading-relaxed">
              ABSORB MAGENTA NODES // AVOID BOUNDARY COLLISION // SYNC TO AUDIO STREAM
            </p>
            <p className="mt-3 font-mono text-lg text-[#FF00FF]">
              <span>ARROWS / WASD</span>
              <span aria-hidden="true" className="mx-2 text-[#00FFFF]">
                ::
              </span>
              <span>SPACE = HALT</span>
            </p>

            <button
              type="button"
              onClick={startNewGame}
              className="mt-6 inline-flex items-center gap-2.5 border-2 border-[#00FFFF] bg-black px-6 py-3 font-display text-xs text-[#00FFFF] shadow-[4px_4px_0_#FF00FF] hover:bg-[#00FFFF]/15 active:translate-x-[2px] active:translate-y-[2px] transition-all duration-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
            >
              <Play className="h-4 w-4 text-[#FF00FF] neon-icon-magenta" />
              INITIALIZE
            </button>
          </div>
        )}

        {/* PAUSED OVERLAY */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020204]/85 p-6 text-center">
            <h2
              data-text="CYCLE_HALTED"
              className="glitch-text font-display text-xl sm:text-2xl text-[#FF00FF] tracking-wider"
            >
              CYCLE_HALTED
            </h2>
            <p className="mt-2 font-mono text-2xl text-[#00FFFF] tabular-nums">
              MEMORY_SCORE: {score}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={togglePause}
                className="inline-flex items-center gap-2 border-2 border-[#00FFFF] bg-black px-4 py-2.5 font-display text-[11px] text-[#00FFFF] shadow-[3px_3px_0_#FF00FF] hover:bg-[#00FFFF]/15 transition-all duration-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
              >
                <Play className="h-4 w-4 text-[#00FFFF] neon-icon-cyan" />
                RESUME
              </button>
              <button
                type="button"
                onClick={startNewGame}
                className="inline-flex items-center gap-2 border-2 border-[#FF00FF] bg-black px-4 py-2.5 font-display text-[11px] text-[#FF00FF] shadow-[3px_3px_0_#00FFFF] hover:bg-[#FF00FF]/15 transition-all duration-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
              >
                <RotateCcw className="h-4 w-4 text-[#FF00FF] neon-icon-magenta" />
                REBOOT
              </button>
            </div>
          </div>
        )}

        {/* GAME OVER OVERLAY */}
        {gameState === 'GAME_OVER' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020204]/90 p-6 text-center">
            <h2
              data-text="TERMINATED"
              className="glitch-text screen-tear font-display text-2xl sm:text-3xl text-[#FF00FF] tracking-wider"
            >
              TERMINATED
            </h2>
            {isNewRecord ? (
              <p className="mt-2 font-mono text-2xl text-[#00FFFF]">
                NEW_PEAK_RECORD
              </p>
            ) : (
              <p className="mt-2 font-mono text-xl text-[#E6FFFF]/75">
                PEAK_RECORD: <span className="tabular-nums text-[#00FFFF]">{highScore}</span>
              </p>
            )}

            <div className="mt-4 flex items-center gap-7">
              <div>
                <span className="block text-[10px] text-[#FF00FF]">FINAL_SCORE</span>
                <span
                  data-text={String(score)}
                  className="glitch-text font-mono text-4xl text-[#00FFFF] tabular-nums"
                >
                  {score}
                </span>
              </div>
              <div className="h-9 w-[2px] bg-[#00FFFF]/40" aria-hidden="true" />
              <div>
                <span className="block text-[10px] text-[#00FFFF]">NODES_EATEN</span>
                <span
                  data-text={String(foodCount)}
                  className="glitch-text font-mono text-4xl text-[#FF00FF] tabular-nums"
                >
                  {foodCount}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={startNewGame}
              className="mt-6 inline-flex items-center gap-2.5 border-2 border-[#00FFFF] bg-black px-6 py-3 font-display text-xs text-[#00FFFF] shadow-[4px_4px_0_#FF00FF] hover:bg-[#00FFFF]/15 active:translate-x-[2px] active:translate-y-[2px] transition-all duration-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
            >
              <RotateCcw className="h-4 w-4 text-[#FF00FF] neon-icon-magenta" />
              REBOOT_CYCLE
            </button>
          </div>
        )}
      </div>

      {/* Bottom Arena Controls Bar */}
      <div className="mt-3.5 w-full max-w-[540px] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePause}
            className="inline-flex h-10 items-center gap-2 border-2 border-[#00FFFF]/65 bg-black px-3 text-[11px] font-bold text-[#00FFFF] hover:bg-[#00FFFF]/15 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
          >
            {gameState === 'PLAYING' ? (
              <>
                <Pause className="h-3.5 w-3.5 text-[#FF00FF] neon-icon-magenta" />
                HALT
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 text-[#00FFFF] neon-icon-cyan" />
                {gameState === 'PAUSED' ? 'RESUME' : 'START'}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={startNewGame}
            className="inline-flex h-10 items-center gap-1.5 border-2 border-[#FF00FF]/65 bg-black px-3 text-[11px] font-bold text-[#FF00FF] hover:bg-[#FF00FF]/15 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#FF00FF] neon-icon-magenta" />
            REBOOT
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWrapWalls((w) => !w)}
            aria-pressed={wrapWalls}
            className={`inline-flex h-10 items-center border-2 px-3 text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF] ${
              wrapWalls
                ? 'border-[#FF00FF] bg-[#FF00FF]/15 text-[#FF00FF]'
                : 'border-[#00FFFF]/50 bg-black text-[#00FFFF] hover:border-[#00FFFF]'
            }`}
          >
            BOUNDS:{wrapWalls ? 'WRAP' : 'SOLID'}
          </button>

          <button
            type="button"
            onClick={handleToggleSfx}
            aria-pressed={sfxEnabled}
            aria-label={sfxEnabled ? 'Disable SFX' : 'Enable SFX'}
            className="inline-flex h-10 items-center gap-1.5 border-2 border-[#00FFFF]/50 bg-black px-3 text-[11px] font-bold text-[#E6FFFF] hover:border-[#00FFFF] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
          >
            {sfxEnabled ? (
              <Volume2 className="h-3.5 w-3.5 text-[#00FFFF] neon-icon-cyan" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-[#FF00FF] neon-icon-magenta" />
            )}
            SFX:{sfxEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Touch / Click Pixel D-Pad for Mobile & Tablet */}
      <div className="mt-4 grid grid-cols-3 gap-2 lg:hidden" aria-label="Directional input pad">
        <div />
        <button
          type="button"
          onClick={() => queueDirection({ x: 0, y: -1 })}
          aria-label="Vector Up"
          className="flex h-12 w-14 items-center justify-center border-2 border-[#00FFFF]/70 bg-black text-[#00FFFF] shadow-[2px_2px_0_#FF00FF] active:bg-[#00FFFF]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
        >
          <ArrowUp className="h-5 w-5 neon-icon-cyan" />
        </button>
        <div />
        <button
          type="button"
          onClick={() => queueDirection({ x: -1, y: 0 })}
          aria-label="Vector Left"
          className="flex h-12 w-14 items-center justify-center border-2 border-[#00FFFF]/70 bg-black text-[#00FFFF] shadow-[2px_2px_0_#FF00FF] active:bg-[#00FFFF]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
        >
          <ArrowLeft className="h-5 w-5 neon-icon-cyan" />
        </button>
        <button
          type="button"
          onClick={() => queueDirection({ x: 0, y: 1 })}
          aria-label="Vector Down"
          className="flex h-12 w-14 items-center justify-center border-2 border-[#00FFFF]/70 bg-black text-[#00FFFF] shadow-[2px_2px_0_#FF00FF] active:bg-[#00FFFF]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
        >
          <ArrowDown className="h-5 w-5 neon-icon-cyan" />
        </button>
        <button
          type="button"
          onClick={() => queueDirection({ x: 1, y: 0 })}
          aria-label="Vector Right"
          className="flex h-12 w-14 items-center justify-center border-2 border-[#00FFFF]/70 bg-black text-[#00FFFF] shadow-[2px_2px_0_#FF00FF] active:bg-[#00FFFF]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
        >
          <ArrowRight className="h-5 w-5 neon-icon-cyan" />
        </button>
      </div>
    </section>
  );
}
