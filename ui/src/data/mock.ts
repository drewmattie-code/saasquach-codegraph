export type Metric = { label: string; value: number; delta: number; data: number[] }
export const velocity: Metric[] = [
  { label: 'Deploys / Week', value: 42, delta: 12.4, data: [22, 25, 29, 30, 34, 38, 42] },
  { label: 'PRs / Day', value: 18, delta: 5.7, data: [10, 12, 14, 16, 14, 17, 18] },
  { label: 'Avg Review Time (h)', value: 4.2, delta: -8.1, data: [7, 6.5, 6, 5.4, 4.8, 4.4, 4.2] },
  { label: 'Lines Changed / Week', value: 28470, delta: 2.1, data: [21000, 22000, 24000, 25100, 26040, 27120, 28470] },
]

export const healthSub = [
  { label: 'Build Stability', value: 98.2, data: [96, 96.4, 97, 97.5, 98.2] },
  { label: 'Test Coverage', value: 84.7, data: [81.1, 82, 83.2, 83.7, 84.7] },
  { label: 'PR Velocity', value: 4.2, data: [5.8, 5.4, 5, 4.6, 4.2] },
  { label: 'Incident Rate', value: 0.3, data: [1.2, 0.8, 0.5, 0.4, 0.3] },
]
