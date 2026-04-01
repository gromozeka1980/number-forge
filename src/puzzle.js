// Puzzle generator — always produces solvable puzzles by construction
import { frac, fracAdd, fracSub, fracMul, fracDiv } from './fraction';

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const ops = [
  { fn: fracAdd, symbol: '+' },
  { fn: fracSub, symbol: '−' },
  { fn: fracMul, symbol: '×' },
  { fn: fracDiv, symbol: '÷' },
];

// Build a puzzle by working forwards from random numbers through a random solution path.
// This guarantees the puzzle is solvable and runs in O(count) time.
export function generatePuzzle(count = 4, difficulty = 'easy') {
  const ranges = {
    easy:   { numMin: 1, numMax: 10 },
    medium: { numMin: 2, numMax: 25 },
    hard:   { numMin: 2, numMax: 50 },
  };
  const { numMin, numMax } = ranges[difficulty];

  for (let attempt = 0; attempt < 50; attempt++) {
    const numbers = [];
    for (let i = 0; i < count; i++) {
      numbers.push(frac(randInt(numMin, numMax)));
    }

    // Simulate a random solution path
    let pool = [...numbers];
    let valid = true;

    while (pool.length > 1) {
      const i = randInt(0, pool.length - 1);
      let j = randInt(0, pool.length - 2);
      if (j >= i) j++;

      // Pick a random operation, but filter out bad results
      const shuffledOps = [...ops].sort(() => Math.random() - 0.5);
      let applied = false;

      for (const op of shuffledOps) {
        const result = op.fn(pool[i], pool[j]);
        if (result === null) continue;
        // Skip results that are too large, zero denominators, or huge fractions
        if (Math.abs(result.n) > 9999 || result.d > 999) continue;

        const newPool = pool.filter((_, k) => k !== i && k !== j);
        newPool.push(result);
        pool = newPool;
        applied = true;
        break;
      }

      if (!applied) {
        // Fallback: just add them
        const result = fracAdd(pool[i], pool[j]);
        pool = pool.filter((_, k) => k !== i && k !== j);
        pool.push(result);
      }
    }

    const target = pool[0];

    // Ensure target is a "nice" number for the difficulty
    if (difficulty === 'easy' && target.d === 1 && target.n >= 1 && target.n <= 100) {
      return { numbers, target };
    }
    if (difficulty === 'medium' && target.d <= 2 && Math.abs(target.n) <= 500) {
      return { numbers, target };
    }
    if (difficulty === 'hard') {
      if (Math.abs(target.n) <= 2000 && target.d <= 10) {
        return { numbers, target };
      }
    }
  }

  // Final fallback — just make a simple addition puzzle
  const numbers = [];
  for (let i = 0; i < count; i++) {
    numbers.push(frac(randInt(numMin, numMax)));
  }
  const target = numbers.reduce((acc, n) => fracAdd(acc, n), frac(0));
  return { numbers, target };
}
