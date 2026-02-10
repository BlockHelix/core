FROM node:22-slim

RUN apt-get update && apt-get install -y curl git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g openclaw@latest

RUN mkdir -p /app/node_modules && npm install --prefix /app ws

ENV PLAYWRIGHT_BROWSERS_PATH=/app/browsers
RUN npx playwright install --with-deps chromium \
  && rm -rf /tmp/* /var/lib/apt/lists/*

COPY adapter.js entrypoint.sh ./
RUN chmod +x entrypoint.sh

RUN mkdir -p /app/data/openclaw /app/data/openclaw/cache /app/data/openclaw/config /app/data/openclaw/workspace /app/data/openclaw/npm \
  && chown -R node:node /app/data /app/browsers
USER node

ENV PORT=3001
ENV NODE_ENV=production
ENV OPENCLAW_AUTO_UPDATE=false
ENV HOME=/app/data/openclaw
ENV XDG_CACHE_HOME=/app/data/openclaw/cache
ENV XDG_CONFIG_HOME=/app/data/openclaw/config
ENV npm_config_cache=/app/data/openclaw/npm

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["./entrypoint.sh"]
