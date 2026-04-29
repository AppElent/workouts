export interface OneRepMaxResult {
  value: number
  source: 'actual' | 'calculated'
  formula?: 'epley'
}

export function calculateOneRepMax(
  weight: number,
  reps: number,
): OneRepMaxResult {
  if (reps === 1) {
    return { value: weight, source: 'actual' }
  }
  const raw = weight * (1 + reps / 30)
  const value = Math.round(raw * 10) / 10
  return { value, source: 'calculated', formula: 'epley' }
}
