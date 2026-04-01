// Fraction math utilities
// A fraction is { n: number, d: number } where d > 0, always reduced

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function frac(n, d = 1) {
  if (d === 0) return null;
  const sign = d < 0 ? -1 : 1;
  const g = gcd(Math.abs(n), Math.abs(d));
  return { n: (sign * n) / g, d: (Math.abs(d)) / g };
}

export function fracAdd(a, b) {
  return frac(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function fracSub(a, b) {
  return frac(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function fracMul(a, b) {
  return frac(a.n * b.n, a.d * b.d);
}

export function fracDiv(a, b) {
  if (b.n === 0) return null;
  return frac(a.n * b.d, a.d * b.n);
}

export function fracEq(a, b) {
  return a.n === b.n && a.d === b.d;
}

export function fracToString(f) {
  if (f.d === 1) return `${f.n}`;
  return `${f.n}/${f.d}`;
}

export function isInteger(f) {
  return f.d === 1;
}

export function fracToNumber(f) {
  return f.n / f.d;
}

export const operations = [
  { symbol: '+', apply: fracAdd, label: '+' },
  { symbol: '−', apply: fracSub, label: '−' },
  { symbol: '×', apply: fracMul, label: '×' },
  { symbol: '÷', apply: fracDiv, label: '÷' },
];
