export interface OneRepMaxResult {
  value: number;
  source: 'actual' | 'calculated';
  formula?: 'epley';
}

/**
 * Calculate 1RM using the Epley formula.
 * - reps === 1: weight is the actual 1RM (no formula)
 * - reps > 1: 1RM = weight × (1 + reps / 30), rounded to 1 decimal
 */
export function calculateOneRepMax(weight: number, reps: number): OneRepMaxResult {
  if (reps === 1) {
    return { value: weight, source: 'actual' };
  }
  const raw = weight * (1 + reps / 30);
  const value = Math.round(raw * 10) / 10;
  return { value, source: 'calculated', formula: 'epley' };
}
