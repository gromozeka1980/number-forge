// Reusable number input component for entering 3-6 numbers

export default function NumberInput({ values, onChange, onSubmit, onCancel, submitLabel = 'Start' }) {
  const addInput = () => {
    if (values.length < 6) onChange([...values, 1]);
  };
  const removeInput = () => {
    if (values.length > 3) onChange(values.slice(0, -1));
  };
  const setInput = (idx, val) => {
    const v = [...values];
    v[idx] = Math.max(1, Math.min(99, parseInt(val) || 1));
    onChange(v);
  };

  return (
    <div className="number-input-section">
      <div className="input-row">
        {values.map((val, i) => (
          <input
            key={i}
            type="number"
            className="num-input"
            min={1}
            max={99}
            value={val}
            onChange={e => setInput(i, e.target.value)}
          />
        ))}
      </div>
      <div className="input-controls">
        <button className="ctrl-btn" onClick={removeInput} disabled={values.length <= 3}>
          −
        </button>
        <span className="input-count">{values.length} numbers</span>
        <button className="ctrl-btn" onClick={addInput} disabled={values.length >= 6}>
          +
        </button>
      </div>
      <div className="input-actions">
        <button className="start-btn" onClick={onSubmit}>{submitLabel}</button>
        {onCancel && <button className="ctrl-btn" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}
