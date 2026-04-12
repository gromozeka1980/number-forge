import { useState } from 'react';
import CampaignMode from './CampaignMode';
import TimeAttackMode from './TimeAttackMode';
import './App.css';

function Menu({ onSelect }) {
  return (
    <div className="menu">
      <h1 className="menu-title">Number Forge</h1>
      <p className="menu-subtitle">Combine numbers to reach the target</p>

      <div className="how-to-play">
        <h3 className="how-to-title">How to play</h3>
        <ol className="how-to-steps">
          <li>Tap a number</li>
          <li>Pick an operation: <span className="how-op" style={{background:'#a6e3a1'}}>+</span> <span className="how-op" style={{background:'#f38ba8'}}>−</span> <span className="how-op" style={{background:'#89b4fa'}}>×</span> <span className="how-op" style={{background:'#fab387'}}>÷</span></li>
          <li>Tap another number to combine</li>
          <li>Repeat until you reach the target!</li>
        </ol>
      </div>

      <div className="menu-cards">
        <button className="menu-card" onClick={() => onSelect('campaign')}>
          <span className="menu-card-icon">&#9733;</span>
          <span className="menu-card-title">Normal Game</span>
          <span className="menu-card-desc">Solve levels, track your progress</span>
        </button>
        <button className="menu-card" onClick={() => onSelect('timeattack')}>
          <span className="menu-card-icon">&#9201;</span>
          <span className="menu-card-title">Time Attack</span>
          <span className="menu-card-desc">5 minutes, solve as many as you can</span>
        </button>
      </div>

      <a className="more-games-link" href="https://caterpillars.games" target="_top">
        More games at caterpillars.games
      </a>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState('menu');

  return (
    <div className="app">
      {mode === 'menu' && <Menu onSelect={setMode} />}
      {mode === 'campaign' && <CampaignMode onBack={() => setMode('menu')} />}
      {mode === 'timeattack' && <TimeAttackMode onBack={() => setMode('menu')} />}
    </div>
  );
}
