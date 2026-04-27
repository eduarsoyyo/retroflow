/** Filter org_chart entries to those active today (or on a given date) */
export function activeOrg<T extends { start_date?: string; end_date?: string }>(entries: T[], onDate?: string): T[] {
  const d = onDate || new Date().toISOString().slice(0, 10)
  return entries.filter(e => {
    const from = e.start_date || '2000-01-01'
    const to = e.end_date || '2099-12-31'
    return from <= d && to >= d
  })
}
