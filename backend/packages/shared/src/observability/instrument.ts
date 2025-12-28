import * as dotenv from 'dotenv';
import * as path from 'path';
import * as Sentry from '@sentry/node';
import {logger} from './logger';

// Load .env from backend root (before any other env var usage)
// Walk up from dist/observability or src/observability to find backend root
let dir = __dirname;
for (let i = 0; i < 10; i++) {
  const envPath = path.join(dir, '.env');
  const result = dotenv.config({path: envPath});
  if (!result.error) break;
  dir = path.dirname(dir);
}

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || 'unknown',

    // Send default PII data (IP, user agent, etc.)
    sendDefaultPii: true,

    // Performance monitoring sample rate
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Filter out sensitive data
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },

    // Ignore common non-actionable errors
    ignoreErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', /^NetworkError/],
  });

  logger.info('Sentry initialized');
}
