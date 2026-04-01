import { useState, useCallback, useRef, useEffect } from 'react';
import { frac, fracEq, isInteger, operations } from './fraction';

let nextId = 1;
export function resetTokenIds() { nextId = 1; }
export function makeToken(fraction) {
  return { id: nextId++, value: fraction };
}

const DIR_OPS = [
  { dir: 'top',    op: operations[0], color: '#a6e3a1' }, // + green
  { dir: 'bottom', op: operations[1], color: '#f38ba8' }, // − red
  { dir: 'right',  op: operations[2], color: '#89b4fa' }, // × blue
  { dir: 'left',   op: operations[3], color: '#fab387' }, // ÷ orange
];

const CIRCLE_RADIUS_DESKTOP = 130;
const CIRCLE_SIZE_DESKTOP = 340;
const CIRCLE_RADIUS_MOBILE = 100;
const CIRCLE_SIZE_MOBILE = 260;
const ARC_ANIM_DURATION = 400;
const FLY_ANIM_DURATION = 300;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 480
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 480);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

function FractionDisplay({ value, className = '' }) {
  if (isInteger(value)) {
    return <span className={`frac-display ${className}`}>{value.n}</span>;
  }
  return (
    <span className={`frac-display frac-compound ${className}`}>
      <span className="frac-num">{value.n}</span>
      <span className="frac-bar" />
      <span className="frac-den">{value.d}</span>
    </span>
  );
}


function getTargetAngles(count) {
  if (count === 1) return [0];
  if (count === 2) return [Math.PI, 0];
  return Array.from({ length: count }, (_, i) =>
    (i / count) * 2 * Math.PI - Math.PI / 2
  );
}

function angleToXY(angle, radius, center) {
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
}

function shortestArc(from, to) {
  let delta = to - from;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return delta;
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

export default function GameBoard({ numbers, target, onSolve, extraHeader, roundKey = 0 }) {
  const isMobile = useIsMobile();
  const CIRCLE_SIZE = isMobile ? CIRCLE_SIZE_MOBILE : CIRCLE_SIZE_DESKTOP;
  const CIRCLE_RADIUS = isMobile ? CIRCLE_RADIUS_MOBILE : CIRCLE_RADIUS_DESKTOP;

  const [tokens, setTokens] = useState([]);
  const [history, setHistory] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [solved, setSolved] = useState(false);
  const [shake, setShake] = useState(false);
  const [confetti, setConfetti] = useState([]);
  const [newTokenId, setNewTokenId] = useState(null);
  const newTokenIdRef = useRef(null);

  // Tap state machine: idle | selectingOp | selectingTarget
  const [tapState, setTapState] = useState('idle');
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [selectedOp, setSelectedOp] = useState(null); // { op, color, dir }
  // For fly animation: { fromId, toId }
  const [flyAnim, setFlyAnim] = useState(null);

  const tokensRef = useRef(tokens);
  const historyRef = useRef(history);
  const targetRef = useRef(target);
  const solvedRef = useRef(solved);

  const anglesRef = useRef({});
  const [renderAngles, setRenderAngles] = useState({});
  const animFrameRef = useRef(null);
  const animStartRef = useRef(null);
  const animFromRef = useRef(null);
  const animToRef = useRef(null);

  tokensRef.current = tokens;
  historyRef.current = history;
  targetRef.current = target;
  solvedRef.current = solved;

  // --- Arc animation ---
  const animateToAngles = useCallback((tokenIds, targetAnglesMap) => {
    const fromAngles = {};
    tokenIds.forEach(id => {
      fromAngles[id] = anglesRef.current[id] ?? targetAnglesMap[id];
    });
    animFromRef.current = fromAngles;
    animToRef.current = targetAnglesMap;
    animStartRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - animStartRef.current;
      const t = Math.min(1, elapsed / ARC_ANIM_DURATION);
      const et = easeOut(t);
      const current = {};
      tokenIds.forEach(id => {
        const from = animFromRef.current[id];
        const to = animToRef.current[id];
        const delta = shortestArc(from, to);
        current[id] = from + delta * et;
      });
      anglesRef.current = { ...current };
      setRenderAngles({ ...current });
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        animFrameRef.current = null;
      }
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  // Reposition tokens on circle when tokens change
  useEffect(() => {
    if (tokens.length === 0) return;
    const TWO_PI = 2 * Math.PI;
    const normalize = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

    tokens.forEach((t, i) => {
      if (anglesRef.current[t.id] === undefined) {
        const defaults = getTargetAngles(tokens.length);
        anglesRef.current[t.id] = defaults[i];
      }
    });

    const idSet = new Set(tokens.map(t => t.id));
    Object.keys(anglesRef.current).forEach(k => {
      if (!idSet.has(Number(k))) delete anglesRef.current[Number(k)];
    });

    const sorted = [...tokens].sort((a, b) =>
      normalize(anglesRef.current[a.id] ?? 0) - normalize(anglesRef.current[b.id] ?? 0)
    );

    const n = sorted.length;
    const ta = getTargetAngles(n);
    const tam = {};

    const anchorId = newTokenIdRef.current;
    if (anchorId !== null && sorted.some(t => t.id === anchorId)) {
      const anchorAngle = anglesRef.current[anchorId];
      const anchorIdx = sorted.findIndex(t => t.id === anchorId);
      const step = TWO_PI / n;
      const rawOffset = anchorAngle - ta[anchorIdx];
      const snappedOffset = Math.round(rawOffset / step) * step;
      sorted.forEach((t, i) => { tam[t.id] = ta[i] + snappedOffset; });
    } else {
      sorted.forEach((t, i) => { tam[t.id] = ta[i]; });
    }

    animateToAngles(tokens.map(t => t.id), tam);
  }, [tokens, animateToAngles]);

  // Initialize / reset
  const numbersKey = numbers.map(n => `${n.n}/${n.d}`).join(',');
  useEffect(() => {
    resetTokenIds();
    anglesRef.current = {};
    const newTokens = numbers.map(n => makeToken(n));
    const ta = getTargetAngles(newTokens.length);
    newTokens.forEach((t, i) => { anglesRef.current[t.id] = ta[i]; });
    setRenderAngles({ ...anglesRef.current });
    setTokens(newTokens);
    setHistory([]);
    setUndoStack([]);
    setTapState('idle');
    setSelectedTokenId(null);
    setSelectedOp(null);
    setFlyAnim(null);
    setSolved(false);
    setConfetti([]);
    setNewTokenId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numbersKey, roundKey]);

  const spawnConfetti = () => {
    setConfetti(Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bd6', '#a66cff'][Math.floor(Math.random() * 6)],
      rotation: Math.random() * 360,
      duration: 1 + Math.random() * 1.5,
    })));
  };

  const applyOperation = useCallback((sourceId, targetId, dirOp) => {
    const curTokens = tokensRef.current;
    const curHistory = historyRef.current;
    const curTarget = targetRef.current;

    const sourceToken = curTokens.find(t => t.id === sourceId);
    const targetToken = curTokens.find(t => t.id === targetId);
    if (!sourceToken || !targetToken) return;

    const result = dirOp.op.apply(sourceToken.value, targetToken.value);
    if (result === null) return;

    setUndoStack(prev => [...prev, { tokens: [...curTokens], history: [...curHistory] }]);

    const newToken = makeToken(result);
    const dropAngle = anglesRef.current[targetId] ?? 0;
    anglesRef.current[newToken.id] = dropAngle;

    const newTokens = curTokens.filter(t => t.id !== sourceId && t.id !== targetId);
    newTokens.push(newToken);

    const step = { a: sourceToken.value, b: targetToken.value, symbol: dirOp.op.symbol, result };
    const newHistory = [...curHistory, step];

    newTokenIdRef.current = newToken.id;
    setNewTokenId(newToken.id);
    setTimeout(() => { newTokenIdRef.current = null; setNewTokenId(null); }, 500);

    setTokens(newTokens);
    setHistory(newHistory);

    if (newTokens.length === 1 && fracEq(newTokens[0].value, curTarget)) {
      setSolved(true);
      setShake(true);
      spawnConfetti();
      setTimeout(() => setShake(false), 600);
      if (onSolve) onSolve();
    }
  }, [onSolve]);

  // --- Tap handlers ---
  const cancelSelection = () => {
    setTapState('idle');
    setSelectedTokenId(null);
    setSelectedOp(null);
  };

  const handleTokenTap = (e, token) => {
    e.stopPropagation();
    if (solvedRef.current || flyAnim) return;

    if (tapState === 'idle' || tapState === 'selectingOp') {
      // Select this token, show petals
      setSelectedTokenId(token.id);
      setSelectedOp(null);
      setTapState('selectingOp');
    } else if (tapState === 'selectingTarget') {
      if (token.id === selectedTokenId) {
        // Tapped same token — cancel
        cancelSelection();
        return;
      }
      // Apply operation: animate source flying to target, then merge
      setFlyAnim({ fromId: selectedTokenId, toId: token.id });
      setTapState('idle');

      const op = selectedOp;
      const srcId = selectedTokenId;
      const tgtId = token.id;

      setSelectedTokenId(null);
      setSelectedOp(null);

      setTimeout(() => {
        setFlyAnim(null);
        applyOperation(srcId, tgtId, op);
      }, FLY_ANIM_DURATION);
    }
  };

  const handlePetalTap = (e, dirOp) => {
    e.stopPropagation();
    setSelectedOp(dirOp);
    setTapState('selectingTarget');
  };

  const handleBackgroundTap = () => {
    if (tapState !== 'idle') {
      cancelSelection();
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    cancelSelection();
    const prev = undoStack[undoStack.length - 1];
    setTokens(prev.tokens);
    setHistory(prev.history);
    setUndoStack(s => s.slice(0, -1));
    setSolved(false);
    setConfetti([]);
    setNewTokenId(null);
  };

  const handleReset = () => {
    if (undoStack.length === 0) return;
    cancelSelection();
    const first = undoStack[0];
    setTokens(first.tokens);
    setHistory([]);
    setUndoStack([]);
    setSolved(false);
    setConfetti([]);
    setNewTokenId(null);
  };

  const center = CIRCLE_SIZE / 2;
  const radius = tokens.length === 1 ? 0 : CIRCLE_RADIUS;

  // Compute fly animation position (source token moves toward target token)
  let flyPos = null;
  if (flyAnim) {
    const fromAngle = renderAngles[flyAnim.fromId] ?? 0;
    const toAngle = renderAngles[flyAnim.toId] ?? 0;
    const fromR = tokens.length === 1 ? 0 : radius;
    flyPos = {
      fromX: angleToXY(fromAngle, fromR, center).x,
      fromY: angleToXY(fromAngle, fromR, center).y,
      toX: angleToXY(toAngle, fromR, center).x,
      toY: angleToXY(toAngle, fromR, center).y,
    };
  }

  return (
    <div onClick={handleBackgroundTap}>
      {confetti.length > 0 && (
        <div className="confetti-container">
          {confetti.map(p => (
            <div
              key={p.id}
              className="confetti-piece"
              style={{
                left: `${p.x}%`,
                backgroundColor: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                transform: `rotate(${p.rotation}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {extraHeader}

      <div className={`target-section ${shake ? 'shake' : ''} ${solved ? 'target-solved' : ''}`}>
        <div className="target-label">TARGET</div>
        <div className="target-number">
          <FractionDisplay value={target} />
        </div>
      </div>

      {solved && (
        <div className="solved-banner">
          <span className="solved-text">Solved!</span>
        </div>
      )}

      <div className="circle-container" style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}>
        {tokens.map((token) => {
          const angle = renderAngles[token.id] ?? 0;
          const r = tokens.length === 1 ? 0 : radius;
          const pos = angleToXY(angle, r, center);
          const isSelected = selectedTokenId === token.id;
          const showPetals = isSelected && tapState === 'selectingOp';
          const isHighlighted = isSelected && tapState === 'selectingTarget';
          const isDropTarget = tapState === 'selectingTarget' && !isSelected;
          const isNew = newTokenId === token.id;
          const isFlying = flyAnim && flyAnim.fromId === token.id;
          const isFlyTarget = flyAnim && flyAnim.toId === token.id;

          return (
            <div
              key={token.id}
              className={[
                'token',
                isHighlighted ? 'token-highlighted' : '',
                isDropTarget ? 'token-drop-target' : '',
                isNew ? 'token-new' : '',
                isFlying ? 'token-flying' : '',
              ].filter(Boolean).join(' ')}
              data-token-id={token.id}
              style={{
                left: pos.x,
                top: pos.y,
                opacity: isFlying ? 0 : 1,
                ...(isHighlighted && selectedOp ? {
                  borderColor: selectedOp.color,
                  boxShadow: `0 0 20px ${selectedOp.color}40`,
                } : {}),
              }}
              onClick={(e) => handleTokenTap(e, token)}
            >
              <FractionDisplay value={token.value} />
              {isHighlighted && selectedOp && (
                <span className="token-op-badge" style={{ backgroundColor: selectedOp.color }}>
                  {selectedOp.op.symbol}
                </span>
              )}
              {showPetals && (
                <div className="petals">
                  {DIR_OPS.map(d => (
                    <div
                      key={d.dir}
                      className={`petal petal-${d.dir}`}
                      style={{ backgroundColor: d.color }}
                      onClick={(e) => handlePetalTap(e, d)}
                    >
                      {d.op.symbol}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Flying token animation */}
        {flyAnim && flyPos && (() => {
          const srcToken = tokens.find(t => t.id === flyAnim.fromId);
          if (!srcToken) return null;
          return (
            <div
              className="token token-fly-anim"
              style={{
                '--fly-from-x': `${flyPos.fromX}px`,
                '--fly-from-y': `${flyPos.fromY}px`,
                '--fly-to-x': `${flyPos.toX}px`,
                '--fly-to-y': `${flyPos.toY}px`,
                animationDuration: `${FLY_ANIM_DURATION}ms`,
                ...(selectedOp ? { borderColor: selectedOp.color } : {}),
              }}
            >
              <FractionDisplay value={srcToken.value} />
            </div>
          );
        })()}
      </div>

      <div className="tokens-hint">
        {tokens.length > 1 && !solved && tapState === 'idle' ? 'Tap a number' : ''}
        {tapState === 'selectingOp' ? 'Pick an operation' : ''}
        {tapState === 'selectingTarget' ? 'Tap target number' : ''}
      </div>

      <div className="controls">
        <button className="ctrl-btn" onClick={handleUndo} disabled={undoStack.length === 0 || solved}>
          <span className="ctrl-icon">↩</span> Undo
        </button>
        <button className="ctrl-btn" onClick={handleReset} disabled={undoStack.length === 0 || solved}>
          <span className="ctrl-icon">↺</span> Reset
        </button>
      </div>
    </div>
  );
}
