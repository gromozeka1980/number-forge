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

const DIRECTION_THRESHOLD = 25;
const CIRCLE_RADIUS_DESKTOP = 130;
const CIRCLE_SIZE_DESKTOP = 340;
const CIRCLE_RADIUS_MOBILE = 100;
const CIRCLE_SIZE_MOBILE = 260;
const ARC_ANIM_DURATION = 400;

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

function HistoryStep({ step, index }) {
  return (
    <div className="history-step" style={{ animationDelay: `${index * 0.05}s` }}>
      <FractionDisplay value={step.a} />
      <span className="history-op">{step.symbol}</span>
      <FractionDisplay value={step.b} />
      <span className="history-eq">=</span>
      <FractionDisplay value={step.result} />
    </div>
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

// Shortest arc between two angles (minimum distance, either direction)
function shortestArc(from, to) {
  let delta = to - from;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return delta;
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * GameBoard — reusable game board component.
 * Props:
 *   numbers: frac[] — starting numbers
 *   target: frac — target to reach
 *   onSolve: () => void — called when solved
 *   extraHeader?: ReactNode — rendered above the board (e.g. progress bar)
 *   roundKey?: number — change to force reset (new round)
 */
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
  const [gesture, setGesture] = useState(null);
  const [newTokenId, setNewTokenId] = useState(null);
  const newTokenIdRef = useRef(null);

  const gestureRef = useRef(null);
  const tokensRef = useRef(tokens);
  const historyRef = useRef(history);
  const targetRef = useRef(target);
  const solvedRef = useRef(solved);
  const rafRef = useRef(null);

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

  useEffect(() => {
    if (tokens.length === 0) return;
    const TWO_PI = 2 * Math.PI;
    const normalize = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

    // Seed new tokens at their initial angle
    tokens.forEach((t, i) => {
      if (anglesRef.current[t.id] === undefined) {
        const defaults = getTargetAngles(tokens.length);
        anglesRef.current[t.id] = defaults[i];
      }
    });

    // Clean up removed tokens
    const idSet = new Set(tokens.map(t => t.id));
    Object.keys(anglesRef.current).forEach(k => {
      if (!idSet.has(Number(k))) delete anglesRef.current[Number(k)];
    });

    // Sort tokens by their CURRENT angle to preserve spatial ordering
    const sorted = [...tokens].sort((a, b) =>
      normalize(anglesRef.current[a.id] ?? 0) - normalize(anglesRef.current[b.id] ?? 0)
    );

    const n = sorted.length;
    const ta = getTargetAngles(n); // standard equal-spaced slots
    const tam = {};

    const anchorId = newTokenIdRef.current;
    if (anchorId !== null && sorted.some(t => t.id === anchorId)) {
      // Rotate the standard layout so the anchor token moves minimally.
      // Snap to nearest slot-step so canonical shapes are preserved
      // (e.g. 2 tokens = horizontal, 3 = triangle pointing up, etc.)
      const anchorAngle = anglesRef.current[anchorId];
      const anchorIdx = sorted.findIndex(t => t.id === anchorId);
      const step = TWO_PI / n;
      const rawOffset = anchorAngle - ta[anchorIdx];
      const snappedOffset = Math.round(rawOffset / step) * step;

      sorted.forEach((t, i) => {
        tam[t.id] = ta[i] + snappedOffset;
      });
    } else {
      sorted.forEach((t, i) => { tam[t.id] = ta[i]; });
    }

    animateToAngles(tokens.map(t => t.id), tam);
  }, [tokens, animateToAngles]);

  // Initialize / reset when numbers or roundKey change
  // Serialize numbers to avoid infinite loop from array reference changes
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
    setGesture(null);
    gestureRef.current = null;
    setSolved(false);
    setConfetti([]);
    setNewTokenId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numbersKey, roundKey]);

  const spawnConfetti = (big = true) => {
    const count = big ? 40 : 20;
    const pieces = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      color: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bd6', '#a66cff'][Math.floor(Math.random() * 6)],
      rotation: Math.random() * 360,
      duration: 1 + Math.random() * 1.5,
    }));
    setConfetti(pieces);
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

  // Pointer handlers
  useEffect(() => {
    const onMove = (e) => {
      const g = gestureRef.current;
      if (!g) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - g.startX;
      const dy = clientY - g.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      g.cursorX = clientX;
      g.cursorY = clientY;
      if (!g.op && dist > DIRECTION_THRESHOLD) {
        const angle = Math.atan2(dy, dx);
        let dir;
        if (angle >= -Math.PI / 4 && angle < Math.PI / 4) dir = 'right';
        else if (angle >= Math.PI / 4 && angle < 3 * Math.PI / 4) dir = 'bottom';
        else if (angle >= -3 * Math.PI / 4 && angle < -Math.PI / 4) dir = 'top';
        else dir = 'left';
        g.op = DIR_OPS.find(d => d.dir === dir);
      }
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const gg = gestureRef.current;
          if (gg) setGesture({ tokenId: gg.tokenId, op: gg.op, cursorX: gg.cursorX, cursorY: gg.cursorY });
        });
      }
    };
    const onUp = (e) => {
      const g = gestureRef.current;
      if (!g) return;
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      gestureRef.current = null;
      setGesture(null);
      if (!g.op) return;
      const els = document.elementsFromPoint(clientX, clientY);
      const tokenEl = els.find(el => el.closest?.('.token[data-token-id]'))?.closest('.token[data-token-id]');
      if (!tokenEl) return;
      const dropId = parseInt(tokenEl.dataset.tokenId);
      if (!dropId || dropId === g.tokenId) return;
      applyOperation(g.tokenId, dropId, g.op);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [applyOperation]);

  const handlePointerDown = (e, token) => {
    if (solvedRef.current) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    gestureRef.current = { tokenId: token.id, startX: clientX, startY: clientY, op: null, cursorX: clientX, cursorY: clientY };
    setGesture({ tokenId: token.id, op: null, cursorX: clientX, cursorY: clientY });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
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
  const activeToken = gesture ? tokens.find(t => t.id === gesture.tokenId) : null;

  return (
    <>
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

      {history.length > 0 && (
        <div className="history-section">
          {history.map((step, i) => (
            <HistoryStep key={i} step={step} index={i} />
          ))}
        </div>
      )}

      <div className="circle-container" style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}>
        {tokens.map((token) => {
          const angle = renderAngles[token.id] ?? 0;
          const r = tokens.length === 1 ? 0 : radius;
          const pos = angleToXY(angle, r, center);
          const isActive = gesture && gesture.tokenId === token.id;
          const isDragging = isActive && gesture.op;
          const isDropTarget = gesture && gesture.op && gesture.tokenId !== token.id;
          const isNew = newTokenId === token.id;

          return (
            <div
              key={token.id}
              className={`token ${isDragging ? 'token-dragging' : ''} ${isDropTarget ? 'token-drop-target' : ''} ${isNew ? 'token-new' : ''}`}
              data-token-id={token.id}
              style={{ left: pos.x, top: pos.y, opacity: isDragging ? 0.3 : 1 }}
              onMouseDown={(e) => handlePointerDown(e, token)}
              onTouchStart={(e) => handlePointerDown(e, token)}
              onDragStart={(e) => e.preventDefault()}
            >
              <FractionDisplay value={token.value} />
              {isActive && !gesture.op && (
                <div className="petals">
                  {DIR_OPS.map(d => (
                    <div key={d.dir} className={`petal petal-${d.dir}`} style={{ backgroundColor: d.color }}>{d.op.symbol}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {gesture && gesture.op && activeToken && (
        <div className="ghost-token" style={{
          left: gesture.cursorX,
          top: gesture.cursorY,
          borderColor: gesture.op.color,
          boxShadow: `0 12px 32px ${gesture.op.color}40`,
        }}>
          <FractionDisplay value={activeToken.value} />
          <span className="ghost-op" style={{ color: gesture.op.color }}>{gesture.op.op.symbol}</span>
        </div>
      )}

      <div className="tokens-hint">
        {tokens.length > 1 && !solved && !gesture ? 'Press a number, swipe direction, drag to target' : ''}
        {gesture && !gesture.op ? 'Swipe a direction to pick operation' : ''}
        {gesture && gesture.op ? 'Drop onto a number' : ''}
      </div>

      <div className="controls">
        <button className="ctrl-btn" onClick={handleUndo} disabled={undoStack.length === 0 || solved}>
          <span className="ctrl-icon">↩</span> Undo
        </button>
        <button className="ctrl-btn" onClick={handleReset} disabled={undoStack.length === 0 || solved}>
          <span className="ctrl-icon">↺</span> Reset
        </button>
      </div>
    </>
  );
}
