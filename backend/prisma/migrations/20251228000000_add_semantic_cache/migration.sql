-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "SemanticCache" (
    "id" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "inputText" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "metadata" JSONB,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector(768),

    CONSTRAINT "SemanticCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SemanticCache_inputHash_key" ON "SemanticCache"("inputHash");

-- CreateIndex
CREATE INDEX "SemanticCache_agentType_idx" ON "SemanticCache"("agentType");

-- CreateIndex
CREATE INDEX "SemanticCache_hitCount_lastUsedAt_idx" ON "SemanticCache"("hitCount", "lastUsedAt");

-- CreateIndex (pgvector)
CREATE INDEX "SemanticCache_embedding_idx" ON "SemanticCache"
USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
