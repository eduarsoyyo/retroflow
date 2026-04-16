// ═══ ERROR HANDLING ═══
// Structured errors with context for logging and user feedback.

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
    public readonly userMessage?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class DataError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DATA_ERROR', context, 'Error al cargar datos. Inténtalo de nuevo.');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context, 'Datos no válidos.');
  }
}

export class AuthError extends AppError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', undefined, 'Sesión expirada. Vuelve a iniciar sesión.');
  }
}

/**
 * Type-safe Result type for operations that can fail.
 * Forces callers to handle both success and error cases.
 */
export type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}
