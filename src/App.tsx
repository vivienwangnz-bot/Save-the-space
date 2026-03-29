/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Rocket, Trophy, AlertTriangle, RefreshCw, Globe } from 'lucide-react';

// --- Constants ---
const TARGET_SCORE = 1000;
const ROCKET_POINTS = 20;
const INITIAL_AMMO = [20, 40, 20]; // Left, Center, Right
const EXPLOSION_RADIUS = 80;
const EXPLOSION_DURATION = 1000; // ms
const PLAYER_MISSILE_SPEED = 10;
const ENEMY_ROCKET_SPEED_MIN = 0.5;
const ENEMY_ROCKET_SPEED_MAX = 1.5;

// --- Types ---
type GameState = 'START' | 'PLAYING' | 'WIN' | 'LOSS';
type Language = 'CN' | 'EN';

interface Point {
  x: number;
  y: number;
}

interface Entity {
  id: number;
  pos: Point;
  target: Point;
  speed: number;
  active: boolean;
}

interface EnemyRocket extends Entity {
  startPos: Point;
}

interface PlayerMissile extends Entity {
  startPos: Point;
  batteryIndex: number;
}

interface Explosion {
  id: number;
  pos: Point;
  radius: number;
  startTime: number;
  active: boolean;
}

interface City {
  id: number;
  x: number;
  destroyed: boolean;
}

interface Battery {
  id: number;
  x: number;
  ammo: number;
  destroyed: boolean;
}

// --- Translations ---
const TRANSLATIONS = {
  CN: {
    title: "新星防御",
    start: "开始游戏",
    restart: "再玩一次",
    win: "任务成功！",
    loss: "防线崩溃！",
    score: "得分",
    ammo: "弹药",
    target: "目标",
    round: "波次",
    tutorial: "点击屏幕发射拦截导弹。预判敌方火箭位置！无限弹药、超大爆炸半径、极速拦截已开启。",
    successMsg: "你成功保卫了城市！",
    failureMsg: "所有炮台已被摧毁。",
    lang: "English"
  },
  EN: {
    title: "Nova Defense",
    start: "Start Game",
    restart: "Play Again",
    win: "Mission Success!",
    loss: "Defense Collapsed!",
    score: "Score",
    ammo: "Ammo",
    target: "Target",
    round: "Wave",
    tutorial: "Click to launch interceptors. Predict rocket paths! Infinite ammo, massive radius, and high speed enabled.",
    successMsg: "You successfully defended the cities!",
    failureMsg: "All batteries have been destroyed.",
    lang: "中文"
  }
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [lang, setLang] = useState<Language>('CN');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [cities, setCities] = useState<City[]>([]);
  const [batteries, setBatteries] = useState<Battery[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  
  // Game entities refs to avoid re-renders
  const enemiesRef = useRef<EnemyRocket[]>([]);
  const missilesRef = useRef<PlayerMissile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const nextIdRef = useRef(0);

  const t = TRANSLATIONS[lang];

  // Initialize Game
  const initGame = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const citySpacing = width / 10;
    
    const newCities: City[] = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: citySpacing * (i + (i < 3 ? 1.5 : 2.5)),
      destroyed: false
    }));

    const newBatteries: Battery[] = [
      { id: 0, x: citySpacing * 0.5, ammo: INITIAL_AMMO[0], destroyed: false },
      { id: 1, x: width / 2, ammo: INITIAL_AMMO[1], destroyed: false },
      { id: 2, x: width - citySpacing * 0.5, ammo: INITIAL_AMMO[2], destroyed: false }
    ];

    setCities(newCities);
    setBatteries(newBatteries);
    setScore(0);
    setRound(1);
    enemiesRef.current = [];
    missilesRef.current = [];
    explosionsRef.current = [];
    spawnTimerRef.current = 0;
    lastTimeRef.current = performance.now();
  }, []);

  const startGame = () => {
    initGame();
    setGameState('PLAYING');
  };

  const toggleLang = () => setLang(l => l === 'CN' ? 'EN' : 'CN');

  // Game Loop
  const update = useCallback((time: number) => {
    if (gameState !== 'PLAYING') {
      requestRef.current = requestAnimationFrame(update);
      return;
    }

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;

    // --- Update Entities ---

    // Spawn Enemies
    spawnTimerRef.current += deltaTime;
    if (spawnTimerRef.current > Math.max(500, 2000 - score / 2)) {
      spawnTimerRef.current = 0;
      const startX = Math.random() * width;
      // Target a random city or battery
      const activeTargets = [
        ...cities.filter(c => !c.destroyed).map(c => ({ x: c.x, type: 'city' })),
        ...batteries.filter(b => !b.destroyed).map(b => ({ x: b.x, type: 'battery' }))
      ];
      
      if (activeTargets.length > 0) {
        const target = activeTargets[Math.floor(Math.random() * activeTargets.length)];
        enemiesRef.current.push({
          id: nextIdRef.current++,
          startPos: { x: startX, y: 0 },
          pos: { x: startX, y: 0 },
          target: { x: target.x, y: height - 40 },
          speed: ENEMY_ROCKET_SPEED_MIN + Math.random() * (ENEMY_ROCKET_SPEED_MAX - ENEMY_ROCKET_SPEED_MIN) + (score / 5000),
          active: true
        });
      }
    }

    // Update Enemies
    enemiesRef.current.forEach(enemy => {
      if (!enemy.active) return;
      
      const dx = enemy.target.x - enemy.pos.x;
      const dy = enemy.target.y - enemy.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < enemy.speed) {
        enemy.active = false;
        // Impact!
        explosionsRef.current.push({
          id: nextIdRef.current++,
          pos: { ...enemy.pos },
          radius: 20,
          startTime: time,
          active: true
        });

        // Check damage to cities/batteries
        setCities(prev => prev.map(c => {
          if (!c.destroyed && Math.abs(c.x - enemy.pos.x) < 30) return { ...c, destroyed: true };
          return c;
        }));
        setBatteries(prev => {
          const next = prev.map(b => {
            if (!b.destroyed && Math.abs(b.x - enemy.pos.x) < 30) return { ...b, destroyed: true };
            return b;
          });
          // Check loss condition
          if (next.every(b => b.destroyed)) {
            setGameState('LOSS');
          }
          return next;
        });
      } else {
        enemy.pos.x += (dx / dist) * enemy.speed;
        enemy.pos.y += (dy / dist) * enemy.speed;
      }
    });

    // Update Player Missiles
    missilesRef.current.forEach(missile => {
      if (!missile.active) return;
      
      const dx = missile.target.x - missile.pos.x;
      const dy = missile.target.y - missile.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < PLAYER_MISSILE_SPEED) {
        missile.active = false;
        explosionsRef.current.push({
          id: nextIdRef.current++,
          pos: { ...missile.target },
          radius: EXPLOSION_RADIUS,
          startTime: time,
          active: true
        });
      } else {
        missile.pos.x += (dx / dist) * PLAYER_MISSILE_SPEED;
        missile.pos.y += (dy / dist) * PLAYER_MISSILE_SPEED;
      }
    });

    // Update Explosions
    explosionsRef.current.forEach(exp => {
      if (!exp.active) return;
      const elapsed = time - exp.startTime;
      if (elapsed > EXPLOSION_DURATION) {
        exp.active = false;
      } else {
        // Collision with enemies
        enemiesRef.current.forEach(enemy => {
          if (enemy.active) {
            const dx = enemy.pos.x - exp.pos.x;
            const dy = enemy.pos.y - exp.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const currentRadius = exp.radius * Math.sin((elapsed / EXPLOSION_DURATION) * Math.PI);
            if (dist < currentRadius) {
              enemy.active = false;
              setScore(s => {
                const newScore = s + ROCKET_POINTS;
                if (newScore >= TARGET_SCORE) {
                  setGameState('WIN');
                } else if (Math.floor(newScore / 200) > Math.floor(s / 200)) {
                  // New round every 200 points
                  setRound(r => r + 1);
                }
                return newScore;
              });
              explosionsRef.current.push({
                id: nextIdRef.current++,
                pos: { ...enemy.pos },
                radius: 15,
                startTime: time,
                active: true
              });
            }
          }
        });
      }
    });

    // Cleanup
    enemiesRef.current = enemiesRef.current.filter(e => e.active);
    missilesRef.current = missilesRef.current.filter(m => m.active);
    explosionsRef.current = explosionsRef.current.filter(e => e.active);

    // --- Render ---
    ctx.clearRect(0, 0, width, height);

    // Draw Ground
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, height - 40, width, 40);

    // Draw Cities
    cities.forEach(city => {
      if (city.destroyed) {
        ctx.fillStyle = '#333';
        ctx.fillRect(city.x - 15, height - 45, 30, 5);
      } else {
        ctx.fillStyle = '#4a90e2';
        ctx.fillRect(city.x - 15, height - 60, 30, 20);
        ctx.fillStyle = '#fff';
        ctx.fillRect(city.x - 10, height - 55, 5, 5);
        ctx.fillRect(city.x + 5, height - 55, 5, 5);
      }
    });

    // Draw Batteries
    batteries.forEach((battery, i) => {
      if (battery.destroyed) {
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.arc(battery.x, height - 40, 20, Math.PI, 0);
        ctx.fill();
      } else {
        ctx.fillStyle = '#e67e22';
        ctx.beginPath();
        ctx.arc(battery.x, height - 40, 25, Math.PI, 0);
        ctx.fill();
      }
    });

    // Draw Enemy Rockets
    ctx.lineWidth = 1;
    enemiesRef.current.forEach(enemy => {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.moveTo(enemy.startPos.x, enemy.startPos.y);
      ctx.lineTo(enemy.pos.x, enemy.pos.y);
      ctx.stroke();
      
      ctx.fillStyle = '#ff4d4d';
      ctx.fillRect(enemy.pos.x - 2, enemy.pos.y - 2, 4, 4);
    });

    // Draw Player Missiles
    missilesRef.current.forEach(missile => {
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.moveTo(missile.startPos.x, missile.startPos.y);
      ctx.lineTo(missile.pos.x, missile.pos.y);
      ctx.stroke();
      
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(missile.pos.x - 2, missile.pos.y - 2, 4, 4);
    });

    // Draw Target Markers (X)
    missilesRef.current.forEach(missile => {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1;
      const size = 5;
      ctx.beginPath();
      ctx.moveTo(missile.target.x - size, missile.target.y - size);
      ctx.lineTo(missile.target.x + size, missile.target.y + size);
      ctx.moveTo(missile.target.x + size, missile.target.y - size);
      ctx.lineTo(missile.target.x - size, missile.target.y + size);
      ctx.stroke();
    });

    // Draw Explosions
    explosionsRef.current.forEach(exp => {
      const elapsed = time - exp.startTime;
      const progress = elapsed / EXPLOSION_DURATION;
      const currentRadius = exp.radius * Math.sin(progress * Math.PI);
      
      const gradient = ctx.createRadialGradient(exp.pos.x, exp.pos.y, 0, exp.pos.x, exp.pos.y, currentRadius);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(0.5, 'rgba(255, 165, 0, 0.6)');
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.pos.x, exp.pos.y, currentRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    requestRef.current = requestAnimationFrame(update);
  }, [gameState, score, cities, batteries]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle Click
  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    // Find best battery to fire from
    let bestBatteryIndex = -1;
    let minDist = Infinity;

    batteries.forEach((battery, i) => {
      if (!battery.destroyed) {
        const dist = Math.abs(battery.x - x);
        if (dist < minDist) {
          minDist = dist;
          bestBatteryIndex = i;
        }
      }
    });

    if (bestBatteryIndex !== -1) {
      const battery = batteries[bestBatteryIndex];
      missilesRef.current.push({
        id: nextIdRef.current++,
        startPos: { x: battery.x, y: window.innerHeight - 40 },
        pos: { x: battery.x, y: window.innerHeight - 40 },
        target: { x, y },
        speed: PLAYER_MISSILE_SPEED,
        active: true,
        batteryIndex: bestBatteryIndex
      });
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-none">
        <div className="flex gap-4">
          <div className="hud-item min-w-[100px]">
            <span className="text-[10px] uppercase tracking-wider opacity-60">{t.score}</span>
            <span className="text-2xl font-mono font-bold text-orange-500">{score}</span>
          </div>
          <div className="hud-item min-w-[100px]">
            <span className="text-[10px] uppercase tracking-wider opacity-60">{t.round}</span>
            <span className="text-2xl font-mono font-bold text-blue-400">{round}</span>
          </div>
          <div className="hud-item min-w-[100px]">
            <span className="text-[10px] uppercase tracking-wider opacity-60">{t.target}</span>
            <span className="text-2xl font-mono font-bold text-zinc-400">{TARGET_SCORE}</span>
          </div>
        </div>

        <button 
          onClick={toggleLang}
          className="pointer-events-auto p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-md border border-white/10"
        >
          <Globe className="w-5 h-5" />
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleCanvasClick}
        onTouchStart={handleCanvasClick}
        className="w-full h-full cursor-crosshair"
      />

      {/* Overlays */}
      <AnimatePresence>
        {gameState === 'START' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="game-overlay"
          >
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center p-8 max-w-md"
            >
              <Rocket className="w-16 h-16 text-orange-500 mx-auto mb-6" />
              <h1 className="text-5xl font-black mb-4 tracking-tighter italic uppercase">{t.title}</h1>
              <p className="text-zinc-400 mb-8 leading-relaxed">{t.tutorial}</p>
              <button onClick={startGame} className="btn-primary">
                {t.start}
              </button>
            </motion.div>
          </motion.div>
        )}

        {gameState === 'WIN' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="game-overlay"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-6" />
              <h2 className="text-4xl font-black mb-2 text-yellow-400">{t.win}</h2>
              <p className="text-zinc-400 mb-8">{t.successMsg}</p>
              <div className="text-6xl font-mono font-bold mb-8 text-white">{score}</div>
              <button onClick={startGame} className="btn-primary flex items-center gap-2 mx-auto">
                <RefreshCw className="w-5 h-5" />
                {t.restart}
              </button>
            </motion.div>
          </motion.div>
        )}

        {gameState === 'LOSS' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="game-overlay"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <AlertTriangle className="w-20 h-20 text-red-500 mx-auto mb-6" />
              <h2 className="text-4xl font-black mb-2 text-red-500">{t.loss}</h2>
              <p className="text-zinc-400 mb-8">{t.failureMsg}</p>
              <div className="text-6xl font-mono font-bold mb-8 text-white">{score}</div>
              <button onClick={startGame} className="btn-primary flex items-center gap-2 mx-auto">
                <RefreshCw className="w-5 h-5" />
                {t.restart}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
