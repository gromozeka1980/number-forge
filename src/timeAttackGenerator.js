// Time Attack round generation
import { frac } from './fraction';
import { findAllReachable } from './solver';

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generate a Time Attack round with unique numbers from 1-9.
 * @param {number} numberCount - 3, 4, or 5
 * @param {Set<string>} usedCombos - set of "1,3,7_42" combo keys already used
 * @returns {{ numbers: frac[], target: frac, comboKey: string } | null}
 */
export function generateTimeAttackRound(numberCount, usedCombos) {
  for (let attempt = 0; attempt < 100; attempt++) {
    // Pick N unique numbers from 1-9
    const pool = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const chosen = pool.slice(0, numberCount).sort((a, b) => a - b);
    const numbersKey = chosen.join(',');

    // Find all reachable positive integers
    const fracs = chosen.map(n => frac(n));
    const reachable = findAllReachable(fracs);
    if (reachable.length === 0) continue;

    // Shuffle reachable targets and find an unused combo
    const shuffled = shuffleArray(reachable);
    for (const target of shuffled) {
      const comboKey = `${numbersKey}_${target}`;
      if (!usedCombos.has(comboKey)) {
        return {
          numbers: fracs,
          target: frac(target),
          comboKey,
        };
      }
    }
    // All targets for this number set are used, try different numbers
  }
  return null; // Extremely unlikely — exhausted all options
}
