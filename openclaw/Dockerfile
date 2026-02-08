FROM node:20-slim

RUN apt-get update && apt-get install -y curl git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g openclaw@latest

COPY adapter.js entrypoint.sh ./
RUN chmod +x entrypoint.sh

RUN mkdir -p /tmp/.openclaw /tmp/.config /tmp/.cache /tmp/.npm && chown -R node:node /tmp
USER node

ENV PORT=3001
ENV NODE_ENV=production
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache
ENV XDG_CONFIG_HOME=/tmp/.config
ENV npm_config_cache=/tmp/.npm

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["./entrypoint.sh"]
