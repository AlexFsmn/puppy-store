import pino from 'pino';

/**
 * Environment configuration for logging
 */
const isProduction = process.env.NODE_ENV === 'production';
const lokiHost = process.env.LOKI_HOST || 'http://localhost:3100';

/**
 * Create base pino logger configuration
 */
function createLoggerConfig(): pino.LoggerOptions {
  const baseConfig: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    formatters: {
      level: (label) => ({level: label}),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  // In development, use pretty printing
  if (!isProduction) {
    return {
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    };
  }

  return baseConfig;
}

/**
 * Create pino transport for Loki
 * Only enabled in production when LOKI_HOST is set
 */
function createLokiTransport(): pino.TransportSingleOptions | null {
  if (!isProduction || !process.env.LOKI_HOST) {
    return null;
  }

  return {
    target: 'pino-loki',
    options: {
      batching: true,
      interval: 5, // seconds
      host: lokiHost,
      labels: {
        app: 'puppy-store',
        environment: process.env.NODE_ENV || 'development',
      },
    },
  };
}

/**
 * Main application logger
 */
export const logger = pino(createLoggerConfig());

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>): pino.Logger {
  return logger.child(context);
}

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(requestId: string, userId?: string): pino.Logger {
  return logger.child({
    requestId,
    ...(userId && {userId}),
  });
}

/**
 * Service-specific loggers
 */
export const loggers = {
  llm: createLogger({service: 'llm'}),
  adoption: createLogger({service: 'adoption_agent'}),
  scoring: createLogger({service: 'scoring'}),
  selection: createLogger({service: 'selection_service'}),
  db: createLogger({service: 'database'}),
  http: createLogger({service: 'http'}),
};

export type {Logger} from 'pino';
