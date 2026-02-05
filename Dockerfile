# Multi-stage build for BlockHelix Agent Runtime

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for both services
COPY agent-runtime/package*.json ./agent-runtime/
COPY agent/package*.json ./agent/

# Install dependencies
RUN cd agent-runtime && npm ci --only=production=false
RUN cd agent && npm ci --only=production=false

# Copy source
COPY agent-runtime/ ./agent-runtime/
COPY agent/ ./agent/

# Copy IDL files needed at runtime
COPY target/idl/ ./target/idl/

# Build TypeScript
RUN cd agent-runtime && npm run build
RUN cd agent && npm run build

# Stage 2: Production
FROM node:20-alpine AS production

RUN apk add --no-cache curl

WORKDIR /app

# Copy built agent-runtime (primary service)
COPY --from=builder /app/agent-runtime/dist ./dist
COPY --from=builder /app/agent-runtime/node_modules ./node_modules
COPY --from=builder /app/agent-runtime/package.json ./

# Copy IDL files
COPY --from=builder /app/target/idl ./target/idl

ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

CMD ["node", "dist/index.js"]
