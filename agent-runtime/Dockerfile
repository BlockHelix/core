FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY idl ./idl

ENV NODE_ENV=production
ENV PORT=3002
ENV FACTORY_IDL_PATH=/app/idl/agent_factory.json
ENV VAULT_IDL_PATH=/app/idl/agent_vault.json
ENV REGISTRY_IDL_PATH=/app/idl/receipt_registry.json

EXPOSE 3002

CMD ["node", "dist/index.js"]
