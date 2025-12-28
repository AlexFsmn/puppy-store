import {Registry, Counter, Histogram, Gauge, collectDefaultMetrics} from 'prom-client';

/**
 * Prometheus metrics registry
 */
export const registry = new Registry();

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({register: registry});

/**
 * HTTP request metrics
 */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [registry],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

/**
 * LLM-specific metrics
 */
export const llmRequestDuration = new Histogram({
  name: 'llm_request_duration_seconds',
  help: 'Duration of LLM requests in seconds',
  labelNames: ['service', 'model', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [registry],
});

export const llmRequestTotal = new Counter({
  name: 'llm_requests_total',
  help: 'Total number of LLM requests',
  labelNames: ['service', 'model', 'status'],
  registers: [registry],
});

export const llmTokensTotal = new Counter({
  name: 'llm_tokens_total',
  help: 'Total number of tokens used',
  labelNames: ['service', 'model', 'type'],
  registers: [registry],
});

export const llmParseFailures = new Counter({
  name: 'llm_parse_failures_total',
  help: 'Total number of LLM response parse failures',
  labelNames: ['service'],
  registers: [registry],
});

/**
 * Recommendation flow metrics
 */
export const recommendationSessionsTotal = new Counter({
  name: 'recommendation_sessions_total',
  help: 'Total number of recommendation sessions',
  labelNames: ['status', 'is_returning_user'],
  registers: [registry],
});

export const recommendationAdoptionRounds = new Histogram({
  name: 'recommendation_adoption_rounds',
  help: 'Number of adoption conversation rounds before completion',
  labelNames: [],
  buckets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  registers: [registry],
});

/**
 * Database metrics
 */
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [registry],
});

/**
 * Active sessions gauge
 */
export const activeRecommendationSessions = new Gauge({
  name: 'active_recommendation_sessions',
  help: 'Number of active recommendation sessions',
  registers: [registry],
});

/**
 * Helper to record LLM request metrics
 */
export function recordLLMRequest(params: {
  service: string;
  model: string;
  durationMs: number;
  status: 'success' | 'error';
  promptTokens?: number;
  completionTokens?: number;
}) {
  const {service, model, durationMs, status, promptTokens, completionTokens} = params;

  llmRequestDuration.observe({service, model, status}, durationMs / 1000);
  llmRequestTotal.inc({service, model, status});

  if (promptTokens) {
    llmTokensTotal.inc({service, model, type: 'prompt'}, promptTokens);
  }
  if (completionTokens) {
    llmTokensTotal.inc({service, model, type: 'completion'}, completionTokens);
  }
}

/**
 * Get metrics endpoint handler
 */
export async function getMetrics(): Promise<string> {
  return registry.metrics();
}

/**
 * Get metrics content type
 */
export function getMetricsContentType(): string {
  return registry.contentType;
}
