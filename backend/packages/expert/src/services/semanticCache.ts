import {createHash} from 'crypto';
import {prisma, loggers} from '@puppy-store/shared';
import {embedText} from '../llm';
import type {AgentType} from './agents';

interface CacheEntry {
  id: string;
  response: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
}

interface CacheConfig {
  similarityThreshold: number; // 0.85 default
  maxEntries: number; // LRU max size
}

const DEFAULT_CONFIG: CacheConfig = {
  similarityThreshold: parseFloat(process.env.SEMANTIC_CACHE_THRESHOLD || '0.85'),
  maxEntries: parseInt(process.env.SEMANTIC_CACHE_MAX_ENTRIES || '10000', 10),
};

/**
 * Normalize input for consistent hashing
 */
function normalizeInput(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Generate SHA256 hash of normalized input + agentType
 */
function hashInput(text: string, agentType: string): string {
  return createHash('sha256').update(`${agentType}:${normalizeInput(text)}`).digest('hex');
}

/**
 * Format embedding array for pgvector
 */
function formatEmbedding(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Search for semantically similar cached responses
 */
export async function searchCache(
  input: string,
  agentType: AgentType,
  config: Partial<CacheConfig> = {}
): Promise<CacheEntry | null> {
  const {similarityThreshold} = {...DEFAULT_CONFIG, ...config};
  const inputHash = hashInput(input, agentType);

  // Fast path: exact hash match
  const exactMatch = await prisma.semanticCache.findFirst({
    where: {inputHash, agentType},
    select: {id: true, response: true, metadata: true},
  });

  if (exactMatch) {
    // Update hit count and lastUsedAt
    await prisma.semanticCache.update({
      where: {id: exactMatch.id},
      data: {
        hitCount: {increment: 1},
        lastUsedAt: new Date(),
      },
    });

    loggers.llm.debug({agentType, cacheHit: 'exact'}, 'Semantic cache exact hit');
    return {
      id: exactMatch.id,
      response: exactMatch.response,
      similarity: 1.0,
      metadata: exactMatch.metadata as Record<string, unknown> | null,
    };
  }

  // Slow path: vector similarity search
  try {
    const embedding = await embedText(input);
    const embeddingStr = formatEmbedding(embedding);

    // Query pgvector for similar entries
    const results = await prisma.$queryRaw<
      Array<{id: string; response: string; metadata: unknown; similarity: number}>
    >`
      SELECT
        id,
        response,
        metadata,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM "SemanticCache"
      WHERE "agentType" = ${agentType}
        AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${similarityThreshold}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT 1
    `;

    if (results.length > 0) {
      const match = results[0];

      // Update hit count and lastUsedAt
      await prisma.semanticCache.update({
        where: {id: match.id},
        data: {
          hitCount: {increment: 1},
          lastUsedAt: new Date(),
        },
      });

      loggers.llm.debug(
        {agentType, cacheHit: 'semantic', similarity: match.similarity},
        'Semantic cache similarity hit'
      );

      return {
        id: match.id,
        response: match.response,
        similarity: match.similarity,
        metadata: match.metadata as Record<string, unknown> | null,
      };
    }
  } catch (err) {
    loggers.llm.error({err, agentType}, 'Semantic cache search error');
  }

  return null;
}

/**
 * Store a new response in the cache
 */
export async function storeInCache(
  input: string,
  response: string,
  agentType: AgentType,
  metadata?: Record<string, unknown>
): Promise<void> {
  const config = DEFAULT_CONFIG;

  try {
    const inputHash = hashInput(input, agentType);
    const embedding = await embedText(input);
    const embeddingStr = formatEmbedding(embedding);

    // Check if we need to evict (LRU)
    const count = await prisma.semanticCache.count();
    if (count >= config.maxEntries) {
      await evictLRU(Math.ceil(config.maxEntries * 0.1)); // Evict 10%
    }

    // Insert new entry using raw SQL for vector type
    await prisma.$executeRaw`
      INSERT INTO "SemanticCache" (id, "agentType", "inputHash", "inputText", embedding, response, metadata, "hitCount", "lastUsedAt", "createdAt")
      VALUES (
        ${createId()},
        ${agentType},
        ${inputHash},
        ${input},
        ${embeddingStr}::vector,
        ${response},
        ${metadata ? JSON.stringify(metadata) : null}::jsonb,
        0,
        NOW(),
        NOW()
      )
      ON CONFLICT ("inputHash") DO UPDATE SET
        response = EXCLUDED.response,
        metadata = EXCLUDED.metadata,
        "lastUsedAt" = NOW()
    `;

    loggers.llm.debug({agentType, inputLength: input.length}, 'Stored in semantic cache');
  } catch (err) {
    loggers.llm.error({err, agentType}, 'Failed to store in semantic cache');
  }
}

/**
 * Evict least recently used entries
 */
async function evictLRU(count: number): Promise<void> {
  try {
    // Delete entries with lowest hitCount and oldest lastUsedAt
    await prisma.$executeRaw`
      DELETE FROM "SemanticCache"
      WHERE id IN (
        SELECT id FROM "SemanticCache"
        ORDER BY "hitCount" ASC, "lastUsedAt" ASC
        LIMIT ${count}
      )
    `;

    loggers.llm.debug({evicted: count}, 'Evicted LRU cache entries');
  } catch (err) {
    loggers.llm.error({err}, 'Failed to evict LRU entries');
  }
}

/**
 * Generate a cuid-like ID
 */
function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `c${timestamp}${random}`;
}

/**
 * Clear all cache entries for an agent type (useful for testing/reset)
 */
export async function clearCache(agentType?: AgentType): Promise<number> {
  if (agentType) {
    const result = await prisma.semanticCache.deleteMany({where: {agentType}});
    return result.count;
  }
  const result = await prisma.semanticCache.deleteMany();
  return result.count;
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  byAgent: Record<string, number>;
  totalHits: number;
}> {
  const [total, byAgent, hits] = await Promise.all([
    prisma.semanticCache.count(),
    prisma.semanticCache.groupBy({
      by: ['agentType'],
      _count: true,
    }),
    prisma.semanticCache.aggregate({
      _sum: {hitCount: true},
    }),
  ]);

  return {
    totalEntries: total,
    byAgent: Object.fromEntries(byAgent.map(a => [a.agentType, a._count])),
    totalHits: hits._sum.hitCount || 0,
  };
}
