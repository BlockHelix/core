# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production stage
FROM node:20-slim
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY idl ./idl

ENV NODE_ENV=production
ENV PORT=3002
ENV FACTORY_IDL_PATH=/app/idl/agent_factory.json
ENV VAULT_IDL_PATH=/app/idl/agent_vault.json
ENV REGISTRY_IDL_PATH=/app/idl/receipt_registry.json

EXPOSE 3002
CMD ["node", "dist/index.js"]
