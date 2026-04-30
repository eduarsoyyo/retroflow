const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })
const pct = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 1 })

export const formatEuro = (n: number) => eur.format(Number.isFinite(n) ? n : 0)
export const formatHours = (n: number) => `${num.format(Number.isFinite(n) ? n : 0)} h`
export const formatPercent = (pct100: number) => pct.format((Number.isFinite(pct100) ? pct100 : 0) / 100)
