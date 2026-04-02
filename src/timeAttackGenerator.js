// Time Attack round generation with optional seeded PRNG
import { frac } from './fraction';
import { findAllReachable } from './solver';

// Simple seeded PRNG (mulberry32)
function createRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convert seed string to number
export function seedFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function shuffleArray(arr, random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Create a round generator for a Time Attack session.
 * If seed is provided, all sessions with the same seed + numberCount
 * will generate the same sequence of rounds.
 * @param {number} numberCount - 3, 4, or 5
 * @param {string|null} seed - optional seed string
 * @returns {{ next: () => { numbers, target, comboKey } | null }}
 */
export function createTimeAttackSession(numberCount, seed) {
  const random = seed != null
    ? createRng(seedFromString(seed + '_' + numberCount))
    : Math.random;
  const usedCombos = new Set();
  let roundIndex = 0;

  return {
    next() {
      // Use a deterministic rng seeded per round to ensure reproducibility
      const roundRng = seed != null
        ? createRng(seedFromString(seed + '_' + numberCount + '_' + roundIndex))
        : Math.random;
      roundIndex++;

      for (let attempt = 0; attempt < 100; attempt++) {
        const pool = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9], roundRng);
        const chosen = pool.slice(0, numberCount).sort((a, b) => a - b);
        const numbersKey = chosen.join(',');

        const fracs = chosen.map(n => frac(n));
        const reachable = findAllReachable(fracs);
        if (reachable.length === 0) continue;

        const shuffled = shuffleArray(reachable, roundRng);
        for (const target of shuffled) {
          const comboKey = `${numbersKey}_${target}`;
          if (!usedCombos.has(comboKey)) {
            usedCombos.add(comboKey);
            return { numbers: fracs, target: frac(target), comboKey };
          }
        }
      }
      return null;
    }
  };
}
