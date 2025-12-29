import {OpenAIEmbeddings} from '@langchain/openai';

export type EmbeddingProvider = 'openai' | 'local';

interface EmbeddingConfig {
  provider?: EmbeddingProvider;
  model?: string;
  dimensions?: number;
}

// Singleton instance
let embeddingsInstance: OpenAIEmbeddings | null = null;
let currentConfig: EmbeddingConfig | null = null;

/**
 * Get the configured embedding dimensions
 * Default: 768 (works for nomic-embed-text-v1.5 and text-embedding-3-small with dimension reduction)
 */
export function getEmbeddingDimensions(): number {
  return parseInt(process.env.EMBEDDING_DIMENSIONS || '768', 10);
}

/**
 * Creates an embeddings instance based on environment configuration.
 * - Production: OpenAI text-embedding-3-small
 * - Local: llama.cpp with nomic-embed-text-v1.5
 */
export function createEmbeddings(config?: EmbeddingConfig): OpenAIEmbeddings {
  const provider = (config?.provider || process.env.EMBEDDING_PROVIDER || 'local') as EmbeddingProvider;
  const dimensions = config?.dimensions || getEmbeddingDimensions();

  // Check if we can reuse existing instance
  if (
    embeddingsInstance &&
    currentConfig?.provider === provider &&
    currentConfig?.dimensions === dimensions
  ) {
    return embeddingsInstance;
  }

  if (provider === 'local') {
    // llama.cpp embedding server exposes OpenAI-compatible API
    const baseURL = process.env.LOCAL_EMBEDDING_BASE_URL || 'http://127.0.0.1:8081/v1';
    const model = config?.model || process.env.LOCAL_EMBEDDING_MODEL || 'nomic-embed-text-v1.5';

    embeddingsInstance = new OpenAIEmbeddings({
      modelName: model,
      configuration: {
        baseURL,
      },
      openAIApiKey: 'not-needed',
    });
  } else {
    // OpenAI
    const model = config?.model || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required for OpenAI embeddings');
    }

    embeddingsInstance = new OpenAIEmbeddings({
      modelName: model,
      dimensions, // text-embedding-3-small supports dimension reduction
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  currentConfig = {provider, dimensions};
  return embeddingsInstance;
}

/**
 * Get embedding for a single text input
 */
export async function embedText(text: string): Promise<number[]> {
  const embeddings = createEmbeddings();
  return embeddings.embedQuery(text);
}

/**
 * Get embeddings for multiple texts (batched)
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const embeddings = createEmbeddings();
  return embeddings.embedDocuments(texts);
}
