const isDev = import.meta.env.DEV

export const logger = {
  info: (...args: unknown[]) => isDev && console.log('[revelio]', ...args),
  warn: (...args: unknown[]) => console.warn('[revelio]', ...args),
  error: (...args: unknown[]) => console.error('[revelio]', ...args),
}
