FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps && npm install -g @openai/codex@0.153.4 @tencent-ai/codebuddy-code@2.147.0
COPY server ./server
COPY lib ./lib
COPY scripts ./scripts
RUN mkdir -p /data/materials /backups && chown -R node:node /app /data /backups
USER node
CMD ["node", "--import", "tsx", "server/main.ts"]
