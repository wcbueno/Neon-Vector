
import React, { useEffect, useRef, useState } from 'react';
import { Game } from './src/core/Game';
import { Upgrade, TIER_CONFIG } from './src/utils/Upgrades';
import { Power } from './src/utils/Powers';
import { soundManager } from './src/core/SoundManager';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  
  const [gameState, setGameState] = useState<'start' | 'playing' | 'paused' | 'levelup' | 'gameover'>('start');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Persistence
  const [highScore, setHighScore] = useState(0);
  const [highCombo, setHighCombo] = useState(0);

  const [hudStats, setHudStats] = useState<any>({ 
    hp: 100, 
    maxHp: 100, 
    score: 0, 
    level: 1, 
    xp: 0, 
    maxXp: 100,
    activeSkills: [],
    skillCooldown: 0,
    skillMaxCooldown: 100,
    dashCooldown: 0,
    dashMaxCooldown: 100,
    combo: 0,
    comboTimer: 0,
    maxComboTimer: 100,
    wave: 1,
    bossActive: false
  });
  const [upgradeOptions, setUpgradeOptions] = useState<(Upgrade | Power)[]>([]);
  const [finalScore, setFinalScore] = useState(0);
  const [bossAnnouncement, setBossAnnouncement] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    // Load Records
    const savedScore = localStorage.getItem('neon_vector_highscore');
    const savedCombo = localStorage.getItem('neon_vector_maxcombo');
    if (savedScore) setHighScore(parseInt(savedScore, 10));
    if (savedCombo) setHighCombo(parseInt(savedCombo, 10));
  }, []);

  useEffect(() => {
    if (canvasRef.current && !gameRef.current) {
      gameRef.current = new Game(canvasRef.current, {
        onGameOver: (score, maxCombo) => {
          setFinalScore(score);
          setGameState('gameover');
          
          // Save Records
          const currentHigh = parseInt(localStorage.getItem('neon_vector_highscore') || '0', 10);
          const currentCombo = parseInt(localStorage.getItem('neon_vector_maxcombo') || '0', 10);
          
          if (score > currentHigh) {
             localStorage.setItem('neon_vector_highscore', score.toString());
             setHighScore(score);
          }
          if (maxCombo > currentCombo) {
             localStorage.setItem('neon_vector_maxcombo', maxCombo.toString());
             setHighCombo(maxCombo);
          }
        },
        onLevelUp: (options) => {
          setUpgradeOptions(options);
          setGameState('levelup');
        },
        onUpdateHUD: (stats) => {
          setHudStats(stats);
        },
        onBossSpawn: (name) => {
          setBossAnnouncement(name);
          setTimeout(() => setBossAnnouncement(null), 4000);
        }
      });
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
         if (gameState === 'playing') {
             togglePause();
         } else if (gameState === 'paused') {
             if (settingsOpen) setSettingsOpen(false);
             else togglePause();
         }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, settingsOpen]);

  const startGame = () => {
    if (gameRef.current) {
      gameRef.current.start();
      setGameState('playing');
    }
  };

  const togglePause = () => {
    if (gameRef.current) {
       gameRef.current.togglePause();
       setGameState(prev => prev === 'paused' ? 'playing' : 'paused');
    }
  };

  const selectUpgrade = (option: Upgrade | Power) => {
    if (gameRef.current) {
      gameRef.current.installUpgrade(option);
      gameRef.current.isPaused = false;
      setGameState('playing');
    }
  };

  const toggleAudio = () => {
    soundManager.toggleMute();
    setIsMuted(!isMuted);
  }

  const restart = () => {
     // Return to Main Menu instead of reloading
     if (gameRef.current) {
         gameRef.current.isRunning = false; 
         gameRef.current = null; 
     }
     soundManager.stopBGM();
     setGameState('start');
     setSettingsOpen(false);
  };

  const abortGame = () => {
     if (gameRef.current) {
         gameRef.current.isRunning = false; // Stop loop
         gameRef.current = null; // Destroy instance so useEffect recreates it for next run
     }
     soundManager.stopBGM();
     setGameState('start');
     setSettingsOpen(false);
  }

  const activeSkillPct = hudStats.skillMaxCooldown ? (hudStats.skillMaxCooldown - hudStats.skillCooldown) / hudStats.skillMaxCooldown * 100 : 0;
  const dashPct = hudStats.dashMaxCooldown ? (hudStats.dashMaxCooldown - hudStats.dashCooldown) / hudStats.dashMaxCooldown * 100 : 0;
  const comboPct = hudStats.maxComboTimer ? (hudStats.comboTimer / hudStats.maxComboTimer) * 100 : 0;

  // Determine Combo Color
  let comboColor = 'text-yellow-400';
  let comboBarColor = 'bg-yellow-400';
  let comboShadow = 'drop-shadow-[0_0_10px_rgba(255,255,0,0.8)]';
  
  if (hudStats.combo > 50) {
      comboColor = 'text-purple-400';
      comboBarColor = 'bg-purple-400';
      comboShadow = 'drop-shadow-[0_0_15px_rgba(192,132,252,0.8)]';
  } else if (hudStats.combo > 25) {
      comboColor = 'text-red-500';
      comboBarColor = 'bg-red-500';
      comboShadow = 'drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]';
  } else if (hudStats.combo > 10) {
      comboColor = 'text-orange-400';
      comboBarColor = 'bg-orange-400';
      comboShadow = 'drop-shadow-[0_0_10px_rgba(251,146,60,0.8)]';
  }

  // Active Skill Label Logic
  let activeSkillLabel = '';
  if (hudStats.activeSkills && hudStats.activeSkills.length > 0) {
     if (hudStats.activeSkills.length > 1) {
         activeSkillLabel = 'OMNI-TOOL';
     } else {
         activeSkillLabel = hudStats.activeSkills[0].replace('_', ' ').toUpperCase();
     }
  }

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden bg-black text-white font-mono select-none"
    >
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full block" />

      {/* BOSS ANNOUNCEMENT */}
      {bossAnnouncement && (
        <div className="absolute top-1/4 left-0 w-full flex items-center justify-center pointer-events-none z-30">
           <div className="bg-black/80 border-y-4 border-red-600 w-full py-6 flex flex-col items-center animate-pulse">
              <h1 className="text-red-500 font-black text-4xl md:text-6xl tracking-widest animate-bounce">WARNING</h1>
              <h2 className="text-white font-bold text-2xl md:text-4xl mt-2">{bossAnnouncement}</h2>
           </div>
        </div>
      )}

      {/* PAUSE BUTTON (PC) */}
      {gameState === 'playing' && (
         <button 
           onClick={togglePause}
           className="absolute top-4 right-4 z-50 p-2 bg-gray-900/50 border border-gray-600 rounded hover:bg-gray-800 text-xs font-bold px-4"
         >
           PAUSE [ESC]
         </button>
      )}

      {/* HUD */}
      {gameState !== 'start' && gameState !== 'gameover' && (
        <>
          {/* Top Left: Vitals */}
          <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none">
             <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-bold text-xl tracking-widest">HP</span>
                <div className="w-64 h-8 bg-gray-900 border border-cyan-500/50 skew-x-[-10deg] relative overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-200"
                      style={{ width: `${(hudStats.hp / hudStats.maxHp) * 100}%` }}
                    />
                    <div className="absolute inset-0 grid grid-cols-10 h-full w-full">
                       {[...Array(10)].map((_, i) => <div key={i} className="border-r border-black/20 h-full"></div>)}
                    </div>
                </div>
                <span className="text-sm font-bold">{Math.ceil(hudStats.hp)}</span>
             </div>
             
             <div className="flex items-center gap-2 mt-1">
                <span className="text-purple-400 font-bold text-sm tracking-widest w-8">XP</span>
                <div className="w-48 h-2 bg-gray-900 border border-purple-500/50 skew-x-[-10deg]">
                   <div 
                      className="h-full bg-purple-500 transition-all duration-200"
                      style={{ width: `${(hudStats.xp / hudStats.maxXp) * 100}%` }}
                    />
                </div>
             </div>
          </div>

          {/* Top Center: Combo Meter & Wave */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
             {/* Wave Counter */}
             <div className={`mb-2 font-bold tracking-[0.3em] ${hudStats.bossActive ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                {hudStats.bossActive ? 'BOSS ENGAGED' : `WAVE ${hudStats.wave}`}
             </div>

             {/* Combo Display */}
             {hudStats.combo > 1 && (
                 <div className="flex flex-col items-center animate-bounce">
                    <div className={`text-5xl md:text-6xl font-black italic ${comboColor} ${comboShadow} transition-all duration-100`} style={{
                        transform: `scale(${1 + Math.min(0.3, (hudStats.combo % 10) / 20)}) rotate(${(hudStats.combo % 2 === 0 ? 2 : -2)}deg)`
                    }}>
                       {hudStats.combo}x
                    </div>
                    <div className="text-xs font-bold tracking-[0.5em] text-white/80 uppercase mt-1">
                        {hudStats.combo > 50 ? 'RAMPAGE' : hudStats.combo > 25 ? 'UNSTOPPABLE' : 'COMBO'}
                    </div>
                    <div className="w-40 h-2 bg-gray-800 mt-1 rounded-full overflow-hidden border border-white/10">
                        <div 
                           className={`h-full ${comboBarColor} transition-all duration-75`}
                           style={{ width: `${comboPct}%` }}
                        />
                    </div>
                 </div>
             )}
          </div>

          {/* Top Right: Score & Level */}
          <div className="absolute top-16 right-4 text-right pointer-events-none">
             <div className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] italic">
               {Math.floor(hudStats.score).toLocaleString()}
             </div>
             <div className="text-cyan-400 text-sm tracking-[0.5em] font-bold">SCORE</div>
             
             <div className="mt-4 flex items-center justify-end gap-2">
               <span className="text-yellow-400 font-bold text-2xl">LVL {hudStats.level}</span>
             </div>
          </div>

          {/* Bottom Left: Dash Status */}
          <div className="absolute bottom-8 left-8 pointer-events-none">
             <div className="flex flex-col items-center">
                <div className="w-32 h-2 bg-gray-800 rounded mb-1">
                   <div className="h-full bg-white transition-all duration-75" style={{width: `${dashPct}%`}}></div>
                </div>
                <span className="text-xs font-bold text-gray-400">DASH [SHIFT]</span>
             </div>
          </div>

          {/* Bottom Right: Skill */}
          {activeSkillLabel && (
            <div className="absolute bottom-8 right-8 pointer-events-none">
               <div className="relative w-24 h-24 border-2 border-cyan-500/30 rounded-full bg-black/60 flex items-center justify-center overflow-hidden backdrop-blur-sm">
                  {activeSkillPct < 100 && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                      <span className="text-cyan-500 font-bold">{Math.ceil(hudStats.skillCooldown / 60)}s</span>
                    </div>
                  )}
                  <div 
                    className="absolute bottom-0 left-0 w-full bg-cyan-500/40 transition-all duration-100 ease-linear"
                    style={{ height: `${activeSkillPct}%` }}
                  />
                  <div className="relative z-10 flex flex-col items-center">
                    <span className="font-bold text-xs tracking-widest text-center">{activeSkillLabel}</span>
                    {hudStats.activeSkills.length > 1 && (
                        <span className="text-[10px] text-cyan-300">x{hudStats.activeSkills.length}</span>
                    )}
                  </div>
               </div>
               <div className="text-center mt-2 text-xs text-cyan-500/80">[SPACE]</div>
            </div>
          )}
        </>
      )}

      {/* Start Screen */}
      {gameState === 'start' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50">
          <div className="relative group cursor-pointer" onClick={startGame}>
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-lg blur opacity-40 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
            <h1 className="relative text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-purple-400 mb-2 tracking-tighter italic">
              NEON VECTOR
            </h1>
          </div>
          <p className="text-cyan-500/80 mb-8 text-lg tracking-[0.2em] font-bold mt-4 animate-pulse">
            PRESS TO START_
          </p>
          
          {/* High Scores */}
          <div className="flex gap-12 mb-8 border-y border-gray-800 py-4 w-full max-w-2xl justify-center">
             <div className="text-center">
                <div className="text-xs text-gray-500 tracking-widest mb-1">HIGH SCORE</div>
                <div className="text-2xl font-bold text-yellow-400">{highScore.toLocaleString()}</div>
             </div>
             <div className="text-center">
                <div className="text-xs text-gray-500 tracking-widest mb-1">MAX COMBO</div>
                <div className="text-2xl font-bold text-purple-400">{highCombo}x</div>
             </div>
          </div>

          <div className="text-center text-sm text-gray-400 pt-8">
             <h3 className="text-white font-bold mb-4 tracking-widest">SYSTEM CONTROLS</h3>
             <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-left">
                <p><span className="text-cyan-500">WASD</span> : MOVEMENT</p>
                <p><span className="text-cyan-500">MOUSE</span> : AIM + FIRE</p>
                <p><span className="text-cyan-500">SHIFT</span> : PHASE DASH</p>
                <p><span className="text-cyan-500">SPACE</span> : ULTIMATE</p>
                <p><span className="text-cyan-500">ESC</span> : PAUSE</p>
             </div>
          </div>
        </div>
      )}

      {/* Pause Menu */}
      {gameState === 'paused' && !settingsOpen && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50 backdrop-blur-sm">
           <h2 className="text-6xl font-black text-white mb-8 tracking-widest italic">PAUSED</h2>
           <div className="flex flex-col gap-4 w-64">
              <button onClick={togglePause} className="py-3 bg-white text-black font-bold hover:bg-cyan-400 transition-colors">RESUME</button>
              <button onClick={() => setSettingsOpen(true)} className="py-3 border border-white text-white font-bold hover:bg-white/10 transition-colors">SETTINGS</button>
              <button onClick={abortGame} className="py-3 border border-red-500 text-red-500 font-bold hover:bg-red-500/10 transition-colors">ABORT RUN</button>
           </div>
        </div>
      )}

      {/* Settings Menu */}
      {settingsOpen && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-[60]">
             <h2 className="text-4xl font-bold text-white mb-8 tracking-widest border-b border-gray-700 pb-4 px-12">SETTINGS</h2>
             <div className="flex flex-col gap-6 w-80">
                <div className="flex justify-between items-center">
                   <span className="text-gray-300 font-bold">MASTER AUDIO</span>
                   <button 
                     onClick={toggleAudio}
                     className={`px-4 py-2 font-bold ${isMuted ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'} rounded`}
                   >
                     {isMuted ? 'MUTED' : 'ACTIVE'}
                   </button>
                </div>
                {/* Future settings can go here */}
                <button onClick={() => setSettingsOpen(false)} className="mt-8 py-3 bg-white text-black font-bold hover:bg-gray-200">BACK</button>
             </div>
         </div>
      )}

      {/* Upgrade Screen */}
      {gameState === 'levelup' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-40 backdrop-blur-md">
          <h2 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 mb-8 md:mb-12 tracking-widest italic drop-shadow-lg">
             {hudStats.level % 10 === 0 ? 'SYSTEM EVOLUTION' : 'SYSTEM UPGRADE'}
          </h2>
          <div className="flex flex-wrap gap-4 md:gap-8 justify-center px-4 max-w-6xl h-3/4 overflow-y-auto">
            {upgradeOptions.map((opt, i) => {
              let borderColor = 'border-cyan-500';
              let icon = '⚡';
              let tierColor = '#fff';
              let label = 'POWER';

              if ('type' in opt && (opt.type === 'active' || opt.type === 'passive')) {
                 borderColor = 'border-purple-500';
                 icon = 'PWR';
                 tierColor = '#d8b4fe'; // purple-300
                 label = 'SPECIAL';
              } 
              else if ('tier' in opt) {
                 const config = TIER_CONFIG[opt.tier];
                 tierColor = config.color;
                 borderColor = `border-[${config.color}]`;
                 icon = opt.category === 'offense' ? '⚔️' : opt.category === 'defense' ? '🛡️' : '⚡';
                 label = config.label;
              }

              return (
                <div 
                  key={i}
                  onClick={() => selectUpgrade(opt)}
                  className={`w-full md:w-72 md:h-96 border-2 bg-gray-900/90 hover:bg-gray-800 p-4 md:p-8 flex flex-col items-center justify-between cursor-pointer transition-all hover:-translate-y-2 hover:shadow-[0_0_50px_rgba(0,0,0,0.5)] group relative overflow-hidden shrink-0`}
                  style={{ borderColor: tierColor }}
                >
                  <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: tierColor }}></div>
                  
                  <div className="absolute top-2 right-2 text-[10px] font-bold px-2 py-1 bg-black/50 border border-white/20">
                    {label}
                  </div>
                  
                  <div className="text-4xl md:text-6xl mb-4 mt-4 md:mt-8 font-black opacity-80 group-hover:scale-110 transition-transform" style={{ color: tierColor }}>
                    {icon}
                  </div>
                  
                  <div className="text-center z-10">
                    <h3 className="text-lg md:text-xl font-black mb-2 md:mb-4 uppercase tracking-wider" style={{ color: tierColor }}>{opt.name}</h3>
                    <p className="text-xs md:text-sm text-gray-300 leading-relaxed border-t border-gray-700 pt-4">
                      {opt.description}
                    </p>
                  </div>
                  
                  <div 
                    className="w-full py-2 text-center text-black font-bold text-sm mt-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: tierColor }}
                  >
                    INSTALL
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 z-50">
           <h1 className="text-6xl md:text-8xl font-black text-white mb-2 tracking-tighter drop-shadow-[0_0_15px_rgba(255,0,0,0.8)]">
             FATAL ERROR
           </h1>
           <div className="text-2xl md:text-3xl text-red-400 mb-12 font-mono tracking-widest border-b-2 border-red-500 pb-2">
             SCORE: {Math.floor(finalScore).toLocaleString()}
           </div>
           <button 
            onClick={restart}
            className="px-12 py-4 bg-white text-red-900 font-bold text-2xl hover:bg-gray-200 transition-colors clip-path-polygon"
          >
            REBOOT SYSTEM
          </button>
        </div>
      )}
    </div>
  );
};

export default App;