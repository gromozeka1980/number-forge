import { useState, useMemo } from 'react';
import { frac } from './fraction';
import { findAllReachable } from './solver';
import { setReachable } from './storage';

export default function LevelSelect({ levels, onPlay, onCreateCustom, onDeleteCustom, onBack }) {
  const [showCreate, setShowCreate] = useState(false);
  const [inputText, setInputText] = useState('');
  const [inputError, setInputError] = useState('');

  // Compute reachable for any levels that don't have it yet, cache in localStorage
  const enrichedLevels = useMemo(() => {
    return levels.map(level => {
      if (level.reachable) return level;
      const fracs = level.numbers.map(n => frac(n));
      const reachable = findAllReachable(fracs);
      setReachable(level.id, reachable);
      return { ...level, reachable };
    });
  }, [levels]);

  const handleCreate = () => {
    const parts = inputText.split(/[,\s]+/).filter(Boolean);
    const nums = parts.map(s => parseInt(s)).filter(n => !isNaN(n) && n >= 1);
    if (nums.length < 3) {
      setInputError('Enter at least 3 numbers');
      return;
    }
    if (nums.length > 6) {
      setInputError('Maximum 6 numbers');
      return;
    }
    setInputError('');
    onCreateCustom(nums);
    setShowCreate(false);
    setInputText('');
  };

  return (
    <div className="level-select">
      <div className="level-select-header">
        <button className="back-btn" onClick={onBack}>Back</button>
        <h2 className="level-select-title">Campaign</h2>
      </div>

      <div className="level-list">
        {enrichedLevels.map(level => {
          const total = level.reachable.length;
          const solved = level.solved.length;
          const isComplete = solved >= total;
          const progress = solved / total;
          const isCustom = level.id.startsWith('custom_');

          return (
            <div
              key={level.id}
              className={`level-card ${isComplete ? 'level-complete' : ''}`}
              onClick={() => onPlay(level.id)}
            >
              <div className="level-card-top">
                <div className="level-numbers">
                  {level.numbers.map((n, i) => (
                    <span key={i} className="level-badge">{n}</span>
                  ))}
                </div>
                {isCustom && (
                  <button
                    className="level-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this custom level?')) {
                        onDeleteCustom(level.id);
                      }
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="level-card-bottom">
                <div className="level-progress-text">
                  {isComplete ? '✓ Complete' : `${solved} / ${total}`}
                </div>
                <div className="progress-bar level-progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showCreate ? (
        <div className="create-level-form">
          <h3 className="create-level-title">Custom Level</h3>
          <input
            type="text"
            inputMode="numeric"
            className="custom-level-input"
            placeholder="e.g. 3 7 12"
            value={inputText}
            onChange={e => { setInputText(e.target.value); setInputError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          {inputError && <div className="custom-level-error">{inputError}</div>}
          <div className="input-actions">
            <button className="start-btn" onClick={handleCreate}>Create</button>
            <button className="ctrl-btn" onClick={() => { setShowCreate(false); setInputError(''); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="create-level-btn" onClick={() => setShowCreate(true)}>
          + Create Custom Level
        </button>
      )}
    </div>
  );
}
