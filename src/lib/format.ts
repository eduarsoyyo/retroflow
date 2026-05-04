// src/lib/format.ts — Formatters for numbers, currency and percentages
// in Spanish locale (es-ES).
//
// Everything here is presentation-only: takes a number, returns a string
// for display in the UI. No business logic, no DB access, no React.
//
// Conventions:
//   - Spanish formatting: thousands `.`, decimals `,` (e.g. `1.234,56`).
//   - Euro suffix uses the `€` character (NOT `EUR` text).
//   - All functions are NaN-safe: invalid input renders `0` rather than
//     `NaN €` or `NaN%`. The caller is expected to guard or default
//     upstream when the value really is missing (use `—` etc).
//   - Functions are pure; same input → same output.

/**
 * Format a number with Spanish thousands separator and 1 decimal.
 * Example: 1234.5 → "1.234,5"
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0,0'
  const [int, dec] = n.toFixed(1).split('.')
  return `${int!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`
}

/**
 * Format a number as euros, no decimals, Spanish locale.
 * Example: 1234.56 → "1.235€"
 *
 * No space before the symbol — kept as `value€` (no separator) for
 * backwards compatibility with the original `fmtEur` from
 * `domain/finance.ts`. If you need a separator, format and concatenate
 * upstream.
 */
export function formatEuro(n: number): string {
  if (!Number.isFinite(n)) return '0€'
  return `${n.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€`
}

/**
 * Format a number compactly (no decimals, Spanish locale, no symbol).
 * Example: 1234 → "1.234"
 */
export function formatNumberCompact(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 })
}

/**
 * Format a percentage with 1 decimal and `%` suffix (Spanish decimal).
 * Example: 12.345 → "12,3%"
 *
 * Input is expected as percentage value (12.3 means 12.3 %), NOT as a
 * 0..1 ratio. Multiply by 100 upstream if your value is a ratio.
 */
export function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return '0,0%'
  return `${n.toFixed(1).replace('.', ',')}%`
}

/**
 * Format hours with 1 decimal and "h" suffix.
 * Example: 7.5 → "7,5 h"
 */
export function formatHours(n: number): string {
  if (!Number.isFinite(n)) return '0,0 h'
  return `${formatNumber(n)} h`
}
