# Chat Service
# Build from backend root: docker build -f packages/chat/Dockerfile -t puppy-store-chat .

FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy workspace config (all packages needed for npm to resolve dependencies)
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/auth/package.json ./packages/auth/
COPY packages/puppies/package.json ./packages/puppies/
COPY packages/expert/package.json ./packages/expert/
COPY packages/chat/package.json ./packages/chat/

# Copy prisma schema and install deps
COPY prisma ./prisma/
RUN npm ci

# Copy source
COPY tsconfig*.json ./
COPY packages/shared ./packages/shared/
COPY packages/chat ./packages/chat/

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build -w @puppy-store/shared && npm run build -w @puppy-store/chat

# Production
FROM node:20-slim
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/chat/dist ./packages/chat/dist
COPY --from=builder /app/packages/chat/package.json ./packages/chat/
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

EXPOSE 3004
CMD ["node", "packages/chat/dist/index.js"]
