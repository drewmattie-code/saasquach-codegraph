export type Metric = { label: string; value: number | string; delta: number; data: number[]; unit?: string }
export const velocity: Metric[] = [
  { label: 'Deploys / Week', value: 42, delta: 12.4, data: [22, 25, 29, 30, 34, 38, 42] },
  { label: 'PRs / Day', value: 18, delta: 5.7, data: [10, 12, 14, 16, 14, 17, 18] },
  { label: 'Avg Review Time', value: '4.2h', delta: -8.1, data: [7, 6.5, 6, 5.4, 4.8, 4.4, 4.2] },
  { label: 'Lines Changed / Week', value: '28.5K', delta: 2.1, data: [21000, 22000, 24000, 25100, 26040, 27120, 28470] },
]

export type HealthMetric = { label: string; value: string; delta: number; data: number[] }
export const healthSub: HealthMetric[] = [
  { label: 'Build Stability', value: '98.2%', delta: 2.1, data: [96, 96.4, 97, 97.5, 98.2] },
  { label: 'Test Coverage', value: '84.7%', delta: 3.6, data: [81.1, 82, 83.2, 83.7, 84.7] },
  { label: 'PR Velocity', value: '4.2h avg', delta: -27.6, data: [5.8, 5.4, 5, 4.6, 4.2] },
  { label: 'Incident Rate', value: '0.3/wk', delta: -75, data: [1.2, 0.8, 0.5, 0.4, 0.3] },
]
