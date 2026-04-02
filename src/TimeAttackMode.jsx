import { useState, useRef, useCallback, useEffect } from 'react';
import { createTimeAttackSession } from './timeAttackGenerator';
import GameBoard from './GameBoard';

const DURATION = 5 * 60;

const COUNT_OPTIONS = [
  { count: 3, label: '3 numbers' },
  { count: 4, label: '4 numbers' },
  { count: 5, label: '5 numbers' },
];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TimeAttackMode({ onBack }) {
  const [phase, setPhase] = useState('setup');
  const [numberCount, setNumberCount] = useState(4);
  const [seed, setSeed] = useState('');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [currentRound, setCurrentRound] = useState(null);
  const [roundKey, setRoundKey] = useState(0);
  const [confetti, setConfetti] = useState([]);
  const [usedSeed, setUsedSeed] = useState('');

  const sessionRef = useRef(null);
  const timerRef = useRef(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const startGame = () => {
    const s = seed.trim() || null;
    sessionRef.current = createTimeAttackSession(numberCount, s);
    const round = sessionRef.current.next();
    if (!round) return;
    setCurrentRound(round);
    setUsedSeed(s || '');
    setScore(0);
    setTimeLeft(DURATION);
    setRoundKey(k => k + 1);
    setPhase('playing');
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setTimeout(() => {
            if (phaseRef.current === 'playing') {
              setPhase('results');
              spawnConfetti();
            }
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const spawnConfetti = () => {
    setConfetti(Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.6,
      color: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bd6', '#a66cff'][Math.floor(Math.random() * 6)],
      rotation: Math.random() * 360,
      duration: 1.5 + Math.random() * 2,
    })));
  };

  const handleSolve = useCallback(() => {
    setScore(s => s + 1);
    const round = sessionRef.current?.next();
    if (!round) {
      setPhase('results');
      spawnConfetti();
      return;
    }
    setTimeout(() => {
      setCurrentRound(round);
      setRoundKey(k => k + 1);
    }, 400);
  }, []);

  // --- Setup ---
  if (phase === 'setup') {
    return (
      <div className="ta-setup">
        <button className="back-btn" onClick={onBack}>Back</button>
        <h2 className="ta-title">Time Attack</h2>
        <p className="ta-desc">Solve as many puzzles as you can in 5 minutes!</p>
        <div className="ta-options">
          {COUNT_OPTIONS.map(opt => (
            <button
              key={opt.count}
              className={`ta-option ${numberCount === opt.count ? 'active' : ''}`}
              onClick={() => setNumberCount(opt.count)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="ta-seed-section">
          <input
            type="text"
            className="ta-seed-input"
            placeholder="Seed (optional)"
            value={seed}
            onChange={e => setSeed(e.target.value)}
          />
          <p className="ta-seed-hint">
            Same seed = same puzzles. Share with friends to compete!
          </p>
        </div>
        <button className="start-btn" onClick={startGame}>Start</button>
      </div>
    );
  }

  // --- Results ---
  if (phase === 'results') {
    return (
      <div className="ta-results">
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
        <div className="ta-results-content">
          <div className="ta-results-icon">&#9201;</div>
          <h2 className="ta-results-title">Time's Up!</h2>
          <div className="ta-score-display">
            <span className="ta-score-number">{score}</span>
            <span className="ta-score-label">puzzles solved</span>
          </div>
          <p className="ta-score-detail">
            {numberCount} numbers · 5 minutes
            {usedSeed && <> · seed: <strong>{usedSeed}</strong></>}
          </p>
          <div className="victory-buttons">
            <button className="ctrl-btn ctrl-new" onClick={() => {
              setConfetti([]);
              startGame();
            }}>
              Play Again
            </button>
            <button className="ctrl-btn" onClick={onBack}>Menu</button>
          </div>
        </div>
      </div>
    );
  }

  // --- Playing ---
  if (!currentRound) return null;

  const timerColor = timeLeft <= 30 ? '#f38ba8' : timeLeft <= 60 ? '#fab387' : '#a6e3a1';

  return (
    <div className="game-container">
      <GameBoard
        numbers={currentRound.numbers}
        target={currentRound.target}
        onSolve={handleSolve}
        roundKey={roundKey}
        extraHeader={
          <div className="ta-header">
            <button className="back-btn-small" onClick={onBack}>Menu</button>
            <div className="ta-timer" style={{ color: timerColor }}>
              {formatTime(timeLeft)}
            </div>
            <div className="ta-score">
              {score} solved
            </div>
          </div>
        }
      />
    </div>
  );
}
