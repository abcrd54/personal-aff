FROM oven/bun:1-slim AS deps
WORKDIR /app
COPY package.json ./
RUN bun install --production --frozen-lockfile || bun install --production

FROM oven/bun:1-slim
WORKDIR /app

RUN apt-get update && apt-get install -y curl --no-install-recommends && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
