export const TERMS: Record<number, string> = {
  1262: 'Fall 2025',
  1264: 'Spring 2026',
  1266: 'Summer 2026',
  1272: 'Fall 2026',
} as const

export const CURR_TERM = parseInt(process.env.SET_TERM ?? '1272', 10)
