import { useState, useCallback, useRef, useEffect } from 'react';
import { frac } from './fraction';
import { findAllReachable } from './solver';
import { loadCampaign, saveCampaign, markSolved, setReachable, addCustomLevel, deleteCustomLevel, getLevelList } from './storage';
import GameBoard from './GameBoard';
import LevelSelect from './LevelSelect';

export default function CampaignMode({ onBack }) {
  const [phase, setPhase] = useState('select'); // select | playing | victory
  const [levels, setLevels] = useState(() => getLevelList());
  const [activeLevelId, setActiveLevelId] = useState(null);
  const [activeLevel, setActiveLevel] = useState(null); // { numbers, reachable, solved }
  const [currentTargetIdx, setCurrentTargetIdx] = useState(0);
  const [roundKey, setRoundKey] = useState(0);
  const [showLevelBanner, setShowLevelBanner] = useState(false);
  const [confetti, setConfetti] = useState([]);
  const timerRef = useRef(null);

  const refreshLevels = () => setLevels(getLevelList());

  const getNextUnsolved = (reachable, solved) => {
    const solvedSet = new Set(solved);
    for (let i = 0; i < reachable.length; i++) {
      if (!solvedSet.has(reachable[i])) return i;
    }
    return -1; // All solved
  };

  const handlePlay = useCallback((levelId) => {
    const data = loadCampaign();
    const level = data.levels[levelId];
    if (!level) return;

    // Compute reachable if not cached
    let reachable = level.reachable;
    if (!reachable) {
      const fracs = level.numbers.map(n => frac(n));
      reachable = findAllReachable(fracs);
      setReachable(levelId, reachable);
      level.reachable = reachable;
    }

    if (reachable.length === 0) {
      alert('No positive integers reachable from these numbers!');
      return;
    }

    const nextIdx = getNextUnsolved(reachable, level.solved);
    if (nextIdx === -1) {
      // Already all solved — start from beginning
      setCurrentTargetIdx(0);
    } else {
      setCurrentTargetIdx(nextIdx);
    }

    setActiveLevelId(levelId);
    setActiveLevel({ numbers: level.numbers, reachable, solved: [...level.solved] });
    setRoundKey(k => k + 1);
    setPhase('playing');
  }, []);

  const handleSolve = useCallback(() => {
    if (!activeLevel || !activeLevelId) return;
    const target = activeLevel.reachable[currentTargetIdx];
    markSolved(activeLevelId, target);

    // Update local solved state
    const newSolved = [...activeLevel.solved, target];
    const updatedLevel = { ...activeLevel, solved: newSolved };
    setActiveLevel(updatedLevel);

    const nextIdx = getNextUnsolved(updatedLevel.reachable, newSolved);
    if (nextIdx === -1) {
      // All done!
      setTimeout(() => {
        setPhase('victory');
        spawnConfetti();
        refreshLevels();
      }, 800);
    } else {
      // Show banner then advance
      setShowLevelBanner(true);
      timerRef.current = setTimeout(() => {
        setShowLevelBanner(false);
        setCurrentTargetIdx(nextIdx);
        setRoundKey(k => k + 1);
      }, 1200);
    }
  }, [activeLevel, activeLevelId, currentTargetIdx]);

  const handleCreateCustom = (numbers) => {
    addCustomLevel(numbers);
    refreshLevels();
  };

  const handleDeleteCustom = (levelId) => {
    deleteCustomLevel(levelId);
    refreshLevels();
  };

  const backToSelect = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowLevelBanner(false);
    setPhase('select');
    refreshLevels();
  };

  const spawnConfetti = () => {
    setConfetti(Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.8,
      color: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bd6', '#a66cff'][Math.floor(Math.random() * 6)],
      rotation: Math.random() * 360,
      duration: 1.5 + Math.random() * 2,
    })));
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // --- Level Select ---
  if (phase === 'select') {
    return (
      <LevelSelect
        levels={levels}
        onPlay={handlePlay}
        onCreateCustom={handleCreateCustom}
        onDeleteCustom={handleDeleteCustom}
        onBack={onBack}
        onLevelsChanged={refreshLevels}
      />
    );
  }

  // --- Victory ---
  if (phase === 'victory') {
    return (
      <div className="challenge-victory">
        {confetti.length > 0 && (
          <div className="confetti-container">
            {confetti.map(p => (
              <div key={p.id} className="confetti-piece" style={{
                left: `${p.x}%`, backgroundColor: p.color,
                animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`,
                transform: `rotate(${p.rotation}deg)`,
              }} />
            ))}
          </div>
        )}
        <div className="victory-content">
          <div className="victory-star">&#9733;</div>
          <h2 className="victory-title">Level Complete!</h2>
          <p className="victory-numbers">
            Numbers: {activeLevel.numbers.join(', ')}
          </p>
          <p className="victory-range">
            All {activeLevel.reachable.length} targets solved!
          </p>
          <div className="victory-buttons">
            <button className="ctrl-btn ctrl-new" onClick={backToSelect}>
              Back to Levels
            </button>
            <button className="ctrl-btn" onClick={onBack}>Menu</button>
          </div>
        </div>
      </div>
    );
  }

  // --- Playing ---
  const targetValue = frac(activeLevel.reachable[currentTargetIdx]);
  const totalTargets = activeLevel.reachable.length;
  const solvedCount = activeLevel.solved.length;
  const numbers = activeLevel.numbers.map(n => frac(n));

  return (
    <div className="game-container">
      <GameBoard
        numbers={numbers}
        target={targetValue}
        onSolve={handleSolve}
        roundKey={roundKey}
        extraHeader={
          <div className="challenge-header">
            <button className="back-btn-small" onClick={backToSelect}>Levels</button>
            <div className="progress-section">
              <div className="progress-label">
                {solvedCount} / {totalTargets} solved
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${(solvedCount / totalTargets) * 100}%` }} />
              </div>
            </div>
          </div>
        }
      />

      {showLevelBanner && (
        <div className="level-complete-overlay">
          <div className="level-complete-text">
            Target {activeLevel.reachable[currentTargetIdx]} solved!
          </div>
        </div>
      )}
    </div>
  );
}
