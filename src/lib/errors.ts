import { logger } from './logger'

export class RevelioError extends Error {
  constructor(
    message: string,
    public code?: string,
    public context?: unknown,
  ) {
    super(message)
    this.name = 'RevelioError'
    logger.error(message, { code, context })
  }
}

export function handleSupabaseError(error: { message: string; code?: string }): never {
  throw new RevelioError(error.message, error.code)
}
