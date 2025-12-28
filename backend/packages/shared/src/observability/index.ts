// Instrument - import this at the very top of your entry point
// import '@puppy-store/shared/observability/instrument';
export {} from './instrument'; // Side-effect only, export nothing

// Logger
export {logger, createLogger, createRequestLogger, loggers, type Logger} from './logger';

// Metrics
export {
  registry,
  httpRequestDuration,
  httpRequestTotal,
  llmRequestDuration,
  llmRequestTotal,
  llmTokensTotal,
  llmParseFailures,
  recommendationSessionsTotal,
  recommendationAdoptionRounds,
  dbQueryDuration,
  activeRecommendationSessions,
  recordLLMRequest,
  getMetrics,
  getMetricsContentType,
} from './metrics';

// Error tracking
export {
  initErrorTracking,
  captureException,
  captureLLMError,
  captureParseFailure,
  addBreadcrumb,
  flushErrors,
  Sentry,
} from './errorTracking';
