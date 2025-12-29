# Systems Design Thinking

This document describes the architectural decisions, trade-offs, and reasoning behind the Puppy Store platform.

## Backend & API Design

### Data Sources

Puppy data is stored in **PostgreSQL** using **Prisma ORM**. The schema includes:

- **User**: Account data with saved preferences from previous adoption sessions
- **Puppy**: Puppy listing data (breed, age, temperament, health status, adoption fee, location)
- **Application**: Adoption applications linking users to puppies (living situation, experience, etc.)
- **ChatRoom**: Chat rooms created for each application (applicant to poster communication)
- **Message**: Individual chat messages within a room
- **ChatReadReceipt**: Tracks read status per user per room
- **SemanticCache**: LLM response cache with pgvector embeddings for similarity search

Data is seeded via `scripts/seed-db.sh` which populates the database with sample puppies across various breeds, ages, and temperaments.

### API Shape

The backend exposes a **RESTful API** via Express.js, organized into microservices:

| Service | Port | Purpose |
|---------|------|---------|
| Auth | 3001 | JWT authentication, user registration |
| Puppies | 3002 | Puppy CRUD, applications, notifications |
| Expert | 3003 | LLM agents (adoption + expert Q&A) |
| Chat | 3004 | WebSocket relay for real-time messaging |

**Example endpoints:**

```
GET  /puppies              # List available puppies (paginated)
GET  /puppies/:id          # Get single puppy
POST /puppies              # Create listing (auth required)
POST /applications         # Submit adoption application
POST /chat/session         # Start AI chat session
POST /chat/session/:id/message  # Send message to AI
POST /expert/ask           # Ask the puppy expert
```

### Pagination

The puppy listings and applications endpoints use cursor-based pagination with Zod validation:

```typescript
const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});
```

Responses include `nextCursor` for efficient infinite scroll on mobile.

### Caching Strategy

**Two-layer caching:**

1. Redis: Chat sessions, user preferences, WebSocket state
2. Semantic Cache: Cached LLM responses with vector similarity search

The semantic cache uses pgvector to find similar previous questions:
- Semantic match: Vector similarity with configurable threshold (default 0.85)
- LRU eviction when cache exceeds 10,000 entries (keeps frequently-asked questions warm, drops one-off queries)

Embedding a question to check the cache is ~25x cheaper than calling the LLM. So even if we embed every request, cache hits save money. With a reasonable hit rate, this pays for itself quickly.

| Operation | Cost (per 1M tokens) |
|-----------|---------------------|
| Embedding (text-embedding-3-small) | $0.02 |
| LLM input (gpt-4o-mini) | $0.15 |
| LLM output (gpt-4o-mini) | $0.60 |

### Error Handling

Centralized error handling with typed error classes:

```typescript
function handlePuppyError(error: unknown, res: Response, fallback: string) {
  if (error instanceof NotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  if (error instanceof ForbiddenError) {
    return res.status(403).json({ error: error.message });
  }
  logger.error({ err: error }, fallback);
  res.status(500).json({ error: fallback });
}
```

### Authentication

The auth service (port 3001) handles registration, login, token refresh, and user profile management, keeping authentication concerns isolated from business logic.

JWT-based authentication with refresh tokens:

- Access tokens: 15 minute expiry
- Refresh tokens: 7 day expiry
- Both tokens stored in platform secure storage via `react-native-keychain` (iOS Keychain / Android Keystore)
- Middleware: `requireAuth` (must be logged in) and `optionalAuth` (enhances response if logged in)

User preferences are persisted to the database when authenticated, enabling "returning user" flows.

### API Gateway (Kong)

Kong sits in front of all services, handling:

- **JWT validation**: Verifies tokens at the gateway level, so services don't need to re-validate
- **Rate limiting**: 200 req/min globally, 60 req/min for LLM endpoints (stored in Redis for distributed counting)
- **Request size limiting**: 10MB max payload
- **Prometheus metrics**: Latency and status code metrics per route
- **Route-based auth**: Public routes (login, register) vs protected routes (applications, expert)

---

## LLM / Tool Integration

The system has three LLM-powered features, each with a different design pattern:

### 1. Ask the Puppy Expert (Q&A)

A simple prompt-response pattern for breed and care questions:

```
User: "Are Golden Retrievers good with kids?"
  - LLM generates answer using training knowledge
  - Response cached semantically for similar future questions
```

The expert agent uses a focused system prompt that keeps responses on-topic (breeds, care, training, health). Safety instructions block prompt injection attempts. Semantic caching means repeated similar questions ("Are Goldens kid-friendly?") return cached responses.

### 2. Puppy Recommendations (Adoption Flow)

A multi-turn conversation that extracts preferences via tool calls, then uses SQL for matching:

```
User: "I want a calm dog for my apartment"
  - Router agent detects adoption intent
  - Adoption agent extracts: {livingSpace: "apartment", activityLevel: "low"}
  - Continues conversation until all preferences collected
  - SQL query filters/scores puppies in milliseconds
  - LLM generates personalized explanation for top 3 matches
```

The LLM extracts structured data (preferences), but the actual matching happens in PostgreSQL with indexed queries. This scales to thousands of puppies without increasing LLM costs.

### 3. Auto-Generated Descriptions

Batch generation of marketing copy for puppy listings:

```
Puppy data: {name: "Max", breed: "Labrador", energyLevel: "high", goodWithKids: true}
  - LLM generates 2-3 sentence engaging description
  - Cached in Redis (TTL: 24h)
  - Invalidated when puppy data changes
```

Higher temperature (0.8) for creative variety. Descriptions are generated on-demand and cached, not pre-generated for all puppies.

---

### Multi-Agent Architecture

The expert service uses **LangGraph** to orchestrate multiple AI agents.

```typescript
// agentGraph.ts - LangGraph state machine definition
const graph = new StateGraph(AgentState)
  // Add nodes (each node is an agent function)
  .addNode('router', routerNode)
  .addNode('adoption', adoptionNode)
  .addNode('expert', expertNode)
  // Start with router
  .addEdge('__start__', 'router')
  // Router routes to the appropriate agent based on intent
  .addConditionalEdges('router', routeFromRouter, {
    adoption: 'adoption',
    expert: 'expert',
  })
  // Agents end after processing
  .addEdge('adoption', END)
  .addEdge('expert', END);

return graph.compile();
```

The graph flows as: Start -> Router -> (Adoption | Expert) -> End

The router uses an LLM with `tool_choice: 'routeToAgent'` to classify intent and decide which agent handles each message. State (preferences, message history, recommendations) is passed between nodes via the `AgentState` annotation.

### Adoption Agent with Tool Calling

The adoption agent uses structured tool calls to extract preferences:

```typescript
const prefsTool = new UpdatePreferencesTool(state.preferences, state.userId);
const breedCheckTool = new CheckBreedAvailabilityTool();
const breedStrictTool = new SetBreedStrictnessTool(state.preferences, state.userId);

const llmWithTools = llm.bindTools([prefsTool, breedCheckTool, breedStrictTool], {
  tool_choice: 'required',
});
```

**Tool definitions:**

```typescript
// UpdatePreferencesTool - extracts user preferences from conversation
{
  name: 'updateUserPreferences',
  schema: z.object({
    livingSpace: z.enum(['apartment', 'house', 'house_with_yard']).optional(),
    activityLevel: z.enum(['low', 'medium', 'high']).optional(),
    hasChildren: z.boolean().optional(),
    experienceLevel: z.enum(['first_time', 'some', 'experienced']).optional(),
    budget: z.number().optional(),
    breedPreference: z.string().optional(),
    // ...
  }),
}

// CheckBreedAvailabilityTool - queries database for available breeds
{
  name: 'checkBreedAvailability',
  schema: z.object({
    breed: z.string(),
  }),
}
```

### Expert Agent (Q&A)

Handles general puppy questions with a focused system prompt:

```typescript
const expertQuestionPrompt = ChatPromptTemplate.fromMessages([
  ['system', `You are a friendly puppy expert. Answer questions about:
- Dog breeds and their characteristics
- Puppy care, training, and health
- Adoption process and preparation

Stay focused on puppy-related topics. Be concise and helpful.`],
  ['human', '{question}'],
]);
```

### Recommendation Pipeline

Once preferences are collected, the system:

1. **Scores puppies** against preferences (weighted scoring)
2. **Selects top matches** with LLM-generated explanations
3. **Returns personalized recommendations** with match percentages

```typescript
// scoringService.ts
const weights = {
  breedMatch: 0.25,
  energyMatch: 0.20,
  kidCompatibility: 0.20,
  petCompatibility: 0.15,
  budgetMatch: 0.10,
  locationMatch: 0.10,
};
```

### Prompt Safety

Input sanitization and content filtering:

```typescript
function sanitizeInput(text: string): string {
  return text
    .trim()
    .slice(0, 2000)  // Length limit
    .replace(/[<>]/g, '');  // Basic XSS prevention
}

function containsBlockedContent(text: string): boolean {
  const blockedPatterns = [
    /ignore.*instructions/i,
    /system.*prompt/i,
    /you.*are.*now/i,
    // ...
  ];
  return blockedPatterns.some(p => p.test(text));
}
```

### LLM Provider Abstraction

Supports both OpenAI and local models (llama.cpp/Ollama):

```typescript
export function createLLM(config?: Partial<LLMConfig>): ChatOpenAI {
  const provider = process.env.LLM_PROVIDER || 'openai';

  if (provider === 'local') {
    return new ChatOpenAI({
      modelName: process.env.LOCAL_LLM_MODEL || 'qwen2.5-3b-instruct',
      configuration: {
        baseURL: process.env.LOCAL_LLM_BASE_URL || 'http://127.0.0.1:11434/v1',
      },
      apiKey: 'not-needed',
    });
  }

  return new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY,
  });
}
```

---

## DevOps & Infrastructure

### Local Development

**Kubernetes-first approach** using Docker Desktop:

```bash
./scripts/dev.sh  # Runs skaffold dev with hot-reload
```

This:
1. Builds Docker images for each service
2. Deploys to local Kubernetes via Helm
3. Watches for file changes and rebuilds automatically
4. Port-forwards services to localhost

**Local LLM option:**

```bash
./scripts/run-llama-cpp.sh  # Starts llama.cpp
```

### Production Deployment

**Azure-based infrastructure** managed by Terraform:

- **AKS** (Azure Kubernetes Service) for container orchestration
- **Azure Database for PostgreSQL** (Flexible Server)
- **Azure Key Vault** for secrets management
- **Azure Container Registry** for Docker images

```hcl
resource "azurerm_kubernetes_cluster" "main" {
  name                = "${var.project_name}-${var.environment}-aks"
  location            = azurerm_resource_group.main.location
  dns_prefix          = var.project_name
  kubernetes_version  = "1.28"

  default_node_pool {
    name       = "default"
    node_count = var.node_count
    vm_size    = "Standard_B2s"
  }
}
```

### CI/CD Pipeline

**GitHub Actions** with matrix builds:

```yaml
jobs:
  build:
    strategy:
      matrix:
        service: [auth, puppies, chat, expert]
    steps:
      - uses: docker/build-push-action@v5
        with:
          context: ./backend
          file: ./backend/packages/${{ matrix.service }}/Dockerfile
          cache-from: type=gha,scope=${{ matrix.service }}
          cache-to: type=gha,mode=max,scope=${{ matrix.service }}
```

Separate workflows for backend and mobile:
- **Backend CI**: Builds all service Docker images in parallel
- **Mobile CI**: Runs ESLint, TypeScript checks, and Jest tests on `ubuntu-latest`

**Trade-off on iOS builds**: We intentionally skip `xcodebuild` in CI. macOS runners are ~10x more expensive than Linux runners ($0.08/min vs $0.008/min) and iOS builds take 5-10 minutes. For a sample project, we validate TypeScript and lint on Linux, deferring the actual iOS build to local development. A production app would add a separate `ios-build` job on `macos-latest` triggered only on release branches or tags.

### Migrations & IaC (Future)

Currently disabled, but the intended production workflow:

- **Database migrations**: Run `prisma migrate deploy` as a Kubernetes Job before deploying new app versions. The job runs in the same namespace with access to the database, ensuring migrations complete before pods roll out. Alternative approaches include init containers (simpler but runs on every pod restart) or Helm pre-upgrade hooks.
- **Terraform changes**: Applied manually with `terraform plan` review before `terraform apply`. For a production system, this would be a separate GitHub Actions workflow triggered on changes to `infra/`, with plan output posted as a PR comment for approval.

**Rollback caveat**: Prisma doesn't have built-in rollback support. For destructive migrations (dropping columns, renaming tables), we'd use expand/contract: deploy new code that works with both schemas, migrate, then remove old column support in a later release. This avoids needing to roll back the database if the app deployment fails.

**Alternative solutions**:
- Blue/green databases: Run two database instances, switch traffic after migration. Simpler rollback (just switch back), but 2x the cost and requires data sync.
- Feature flags: Gate new code paths behind flags, roll back by flipping the flag. Good for app changes, but doesn't help with schema changes already applied.

### Observability Stack

| Tool | Purpose |
|------|---------|
| **Sentry** | Error tracking and performance monitoring |
| **LangSmith** | LLM tracing, prompt debugging, feedback collection |
| **Prometheus** | Metrics collection (via Helm chart) |
| **Pino** | Structured JSON logging |

**LangSmith integration** traces the full agent execution:

```typescript
const tracer = new LangChainTracer({
  projectName: process.env.LANGCHAIN_PROJECT || 'puppy-store',
});

const result = await graph.invoke(state, {
  callbacks: [tracer, runCollector],
  metadata: {
    userId: state.userId,
    sessionId: options.sessionId,
  },
});
```

This enables:
- Viewing full conversation traces
- Debugging routing decisions
- Collecting user feedback (thumbs up/down)
- Monitoring token usage and latency
- Tracking outcome metrics: comparing recommended puppies vs. which ones users actually selected or applied for, enabling data-driven improvements to the scoring weights

### Environment Configuration

Helm values for different environments:

- `values.yaml`: Production defaults (OpenAI, Azure PostgreSQL)
- `values-local.yaml`: Local development (local LLM, Docker Desktop K8s)

Key differences:

| Setting | Local | Production |
|---------|-------|------------|
| LLM Provider | llama.cpp/Ollama | OpenAI |
| Database | In-cluster PostgreSQL | Azure Database |
| Image Pull | `Never` (local builds) | `Always` (ACR) |
| Replicas | 1 | 2+ |
| Log Level | debug | info |

---

## Trade-offs & Discussion Points

### Why Microservices?

**Decision**: Split into 4 services (auth, puppies, expert, chat) rather than a monolith.

**Reasoning**: The LLM workloads (expert service) have very different resource profiles than CRUD operations. Separating them allows independent scaling and deployment. The chat service needs WebSocket support which benefits from isolation.

**Trade-off**: Added complexity in local development. Used Skaffold to make the multi-service setup feel like running a single app. We could start as a monolith and extract later but went for microservices upfront because the domain boundaries were clear.

### Why LangGraph over Simple Chains?

**Decision**: Use LangGraph's state machine for the multi-agent system.

**Reasoning**: The adoption flow requires stateful, multi-turn conversations with conditional routing. LangGraph provides:
- Explicit state management
- Visual debugging in LangSmith
- Clean separation between agents
- Built-in support for tool calling loops

**Trade-off**: Steeper learning curve than simple prompt chains. Worth it for the observability benefits.

### Why Semantic Caching?

**Decision**: Cache LLM responses using vector similarity, not just exact matches.

**Reasoning**: "What's a good dog for apartments?" and "Which breeds work well in small spaces?" should return cached results. Reduces costs and latency for similar queries.

**Trade-off**: Requires an embedding model and pgvector. Added complexity, but the cost savings at scale justify it. Uses exact match if pgvector isn't available.

### Why Kubernetes for Local Dev?

**Decision**: Run the same Helm charts locally via Docker Desktop Kubernetes.

**Reasoning**: Eliminates "works on my machine" issues. The local environment matches production closely. Skaffold's hot-reload makes the DX acceptable.

**Trade-off**: Higher resource usage than docker-compose. Requires Docker Desktop with Kubernetes enabled.

Could use docker-compose for local and Kubernetes for prod. Chose consistency over lower local resource usage.

### Scalability: LLM for Understanding, SQL for Execution

**Decision**: Use the LLM to extract structured preferences, but execute recommendations via SQL queries.

**Reasoning**: LLM calls are slow (~1-3s) and expensive. If every recommendation required an LLM to evaluate each puppy, the system wouldn't scale. Instead:

1. LLM extracts preferences once (living space, activity level, budget, etc.)
2. SQL does the heavy lifting (filters and scores puppies in milliseconds)
3. LLM explains the results (generates personalized explanations for top matches)

This means 100 puppies or 10,000 puppies cost roughly the same in LLM tokens. The adoption agent makes 2-5 LLM calls per conversation (to extract preferences), not per puppy. The scoring and filtering happens entirely in PostgreSQL with indexed queries.

Same pattern for semantic cache: The embedding lookup is O(1) hash or O(log n) vector search, not O(n) LLM calls. The LLM is only invoked on cache misses.

**Result**: The system can handle significantly more users by scaling the database horizontally (read replicas) without proportionally increasing LLM costs.

### What I'd Do Differently with More Time

1. **Add RAG for expert answers**: Currently the expert agent uses only the model's training data. Would add vector search over breed/care documentation.

2. **Streaming responses**: The chat currently waits for full LLM responses. Streaming would improve perceived latency.

3. **More rigid prompt injection handling**: Current system has regex-based blocklists for common injection patterns, but a production system would benefit from a dedicated guardrails layer (e.g., Guardrails AI, NeMo Guardrails) that validates both inputs and outputs.

4. **Test coverage in CI**: Both the mobile app and backend have minimal test suites. Would add integration tests for the LangGraph flows (with mocked LLM responses), API endpoint tests for the backend services, and component/E2E tests for the React Native app. All should run in CI-backend tests on Linux, mobile tests via Jest on Linux with optional E2E tests on macOS for critical flows.

5. **Observability gaps**: Prometheus metrics are collected but not acted on. Would add:
- Alertmanager rules (alert if LLM error rate > 5% for example)
- Grafana dashboards for metrics, defined SLOs like ("95% of LLM requests under 3s")
- OpenTelemetry for distributed tracing across services (currently Sentry traces each service independently)
- I've successfully used DataDog in my past projects which could used as an alternative to the currently selected stack but would be more expensive depending on scale.