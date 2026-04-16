// ═══ LOGGER ═══
// Structured logging with levels. In production, could pipe to Sentry/Datadog.

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const configLevel: LogLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'warn';

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[configLevel];
}

function formatMsg(level: LogLevel, module: string, msg: string, ctx?: Record<string, unknown>): string {
  const ts = new Date().toISOString().slice(11, 23);
  return `[${ts}] [revelio:${module}] ${level.toUpperCase()}: ${msg}${ctx ? ' ' + JSON.stringify(ctx) : ''}`;
}

export function createLogger(module: string) {
  return {
    debug: (msg: string, ctx?: Record<string, unknown>) => {
      if (shouldLog('debug')) console.debug(formatMsg('debug', module, msg, ctx));
    },
    info: (msg: string, ctx?: Record<string, unknown>) => {
      if (shouldLog('info')) console.info(formatMsg('info', module, msg, ctx));
    },
    warn: (msg: string, ctx?: Record<string, unknown>) => {
      if (shouldLog('warn')) console.warn(formatMsg('warn', module, msg, ctx));
    },
    error: (msg: string, error?: unknown, ctx?: Record<string, unknown>) => {
      if (shouldLog('error')) {
        console.error(formatMsg('error', module, msg, ctx));
        if (error instanceof Error) console.error(error.stack);
        // TODO: In production, send to error tracking service
        // errorTracker.capture(error, { module, msg, ...ctx });
      }
    },
  };
}
