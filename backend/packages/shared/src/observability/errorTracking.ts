import * as Sentry from '@sentry/node';
import {logger} from './logger';

/**
 * Initialize Sentry error tracking
 *
 * IMPORTANT: For best results, import instrument.ts at the very top of your
 * application entry point BEFORE any other imports:
 *
 *   import '@puppy-store/shared/observability/instrument';
 *
 * Or call this function early in your app startup if you need more control.
 */
export function initErrorTracking() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.warn('SENTRY_DSN not set, error tracking disabled');
    return;
  }

  // Check if already initialized (e.g., via instrument.ts)
  if (Sentry.getClient()) {
    logger.debug('Sentry already initialized');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || 'unknown',
    sendDefaultPii: true,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },

    ignoreErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', /^NetworkError/],
  });

  logger.info('Sentry error tracking initialized');
}

/**
 * Capture an exception with additional context
 */
export function captureException(
  error: Error,
  context?: {
    userId?: string;
    sessionId?: string;
    service?: string;
    extra?: Record<string, unknown>;
  }
) {
  Sentry.withScope((scope) => {
    if (context?.userId) {
      scope.setUser({id: context.userId});
    }
    if (context?.sessionId) {
      scope.setTag('sessionId', context.sessionId);
    }
    if (context?.service) {
      scope.setTag('service', context.service);
    }
    if (context?.extra) {
      scope.setExtras(context.extra);
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture an LLM-specific error with prompt context
 */
export function captureLLMError(
  error: Error,
  context: {
    service: string;
    model: string;
    promptLength?: number;
    userId?: string;
    sessionId?: string;
  }
) {
  Sentry.withScope((scope) => {
    scope.setTag('llm.service', context.service);
    scope.setTag('llm.model', context.model);
    scope.setExtra('promptLength', context.promptLength);

    if (context.userId) {
      scope.setUser({id: context.userId});
    }
    if (context.sessionId) {
      scope.setTag('sessionId', context.sessionId);
    }

    Sentry.captureException(error);
  });
}

/**
 * Capture a parse failure (LLM returned invalid format)
 */
export function captureParseFailure(
  service: string,
  rawOutput: string,
  expectedFormat: string,
  context?: {
    userId?: string;
    sessionId?: string;
  }
) {
  Sentry.withScope((scope) => {
    scope.setTag('error.type', 'parse_failure');
    scope.setTag('service', service);
    scope.setExtra('rawOutput', rawOutput.slice(0, 1000)); // Truncate for privacy
    scope.setExtra('expectedFormat', expectedFormat);

    if (context?.userId) {
      scope.setUser({id: context.userId});
    }
    if (context?.sessionId) {
      scope.setTag('sessionId', context.sessionId);
    }

    Sentry.captureMessage(`LLM parse failure in ${service}`, 'warning');
  });
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  });
}

/**
 * Flush pending events (call before process exit)
 */
export async function flushErrors(timeout = 2000): Promise<boolean> {
  return Sentry.close(timeout);
}

// Re-export Sentry for advanced usage
export {Sentry};
