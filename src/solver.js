// Brute-force solver: finds all positive integers reachable
// by using ALL given numbers with +, −, ×, ÷
import { frac, fracAdd, fracSub, fracMul, fracDiv, fracEq, isInteger } from './fraction';

const ops = [fracAdd, fracSub, fracMul, fracDiv];

/**
 * Find all positive integers reachable from a set of numbers
 * using all numbers exactly once.
 * @param {Array<{n:number, d:number}>} numbers - array of fractions
 * @returns {number[]} sorted array of positive integers
 */
export function findAllReachable(numbers) {
  const results = new Set();

  function solve(pool) {
    if (pool.length === 1) {
      const r = pool[0];
      if (isInteger(r) && r.n > 0) {
        results.add(r.n);
      }
      return;
    }

    // Pick every pair (i, j) where i ≠ j
    for (let i = 0; i < pool.length; i++) {
      for (let j = 0; j < pool.length; j++) {
        if (i === j) continue;
        const rest = pool.filter((_, k) => k !== i && k !== j);

        for (const op of ops) {
          const result = op(pool[i], pool[j]);
          if (result === null) continue;
          // Skip huge numbers to prevent blowup
          if (Math.abs(result.n) > 100000 || result.d > 100000) continue;
          solve([...rest, result]);
        }
      }
    }
  }

  solve(numbers);

  return Array.from(results).sort((a, b) => a - b);
}
