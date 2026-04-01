import { useState, useEffect } from 'react';
import { frac } from './fraction';
import { findAllReachable } from './solver';
import { setReachable } from './storage';
import NumberInput from './NumberInput';

export default function LevelSelect({ levels, onPlay, onCreateCustom, onDeleteCustom, onBack, onLevelsChanged }) {
  const [showCreate, setShowCreate] = useState(false);
  const [inputValues, setInputValues] = useState([1, 2, 3, 4]);

  // Compute reachable for any levels that don't have it yet
  useEffect(() => {
    let changed = false;
    for (const level of levels) {
      if (!level.reachable) {
        const fracs = level.numbers.map(n => frac(n));
        const reachable = findAllReachable(fracs);
        setReachable(level.id, reachable);
        changed = true;
      }
    }
    if (changed && onLevelsChanged) onLevelsChanged();
  }, [levels, onLevelsChanged]);

  const handleCreate = () => {
    onCreateCustom(inputValues);
    setShowCreate(false);
    setInputValues([1, 2, 3, 4]);
  };

  return (
    <div className="level-select">
      <div className="level-select-header">
        <button className="back-btn" onClick={onBack}>Back</button>
        <h2 className="level-select-title">Campaign</h2>
      </div>

      <div className="level-list">
        {levels.map(level => {
          const total = level.reachable ? level.reachable.length : '?';
          const solved = level.solved.length;
          const isComplete = level.reachable && solved >= level.reachable.length;
          const progress = level.reachable ? (solved / level.reachable.length) : 0;
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
                {level.reachable && (
                  <div className="progress-bar level-progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create custom level */}
      {showCreate ? (
        <div className="create-level-form">
          <h3 className="create-level-title">Custom Level</h3>
          <NumberInput
            values={inputValues}
            onChange={setInputValues}
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            submitLabel="Create"
          />
        </div>
      ) : (
        <button className="create-level-btn" onClick={() => setShowCreate(true)}>
          + Create Custom Level
        </button>
      )}
    </div>
  );
}
