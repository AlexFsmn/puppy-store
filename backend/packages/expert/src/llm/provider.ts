import {ChatOpenAI} from '@langchain/openai';

export type LLMProvider = 'openai' | 'local';

interface LLMConfig {
  provider: LLMProvider;
  model?: string;
  temperature?: number;
}

/**
 * Creates an LLM instance based on environment configuration.
 * - Production: Uses OpenAI API
 * - Local: Uses llama.cpp with OpenAI-compatible API
 */
export function createLLM(config?: Partial<LLMConfig>): ChatOpenAI {
  const provider = (config?.provider || process.env.LLM_PROVIDER || 'openai') as LLMProvider;
  const temperature = config?.temperature ?? 0.7;

  if (provider === 'local') {
    // llama.cpp exposes an OpenAI-compatible API
    const baseURL = process.env.LOCAL_LLM_BASE_URL || 'http://127.0.0.1:11434/v1';
    const model = config?.model || process.env.LOCAL_LLM_MODEL || 'qwen2.5-3b-instruct';

    return new ChatOpenAI({
      modelName: model,
      temperature,
      configuration: {
        baseURL,
      },
      apiKey: 'not-needed',
    });
  }

  // Default: OpenAI
  const model = config?.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required for OpenAI provider');
  }

  return new ChatOpenAI({
    modelName: model,
    temperature,
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * Get the current LLM provider name for logging/debugging
 */
export function getCurrentProvider(): LLMProvider {
  return (process.env.LLM_PROVIDER || 'openai') as LLMProvider;
}
