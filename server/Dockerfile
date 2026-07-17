FROM oven/bun:1 AS production
WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY server/package.json server/bun.lock ./
RUN bun install --frozen-lockfile --production

COPY server/ ./server/
COPY common/ ./common/

USER bun

ENTRYPOINT [ "bun", "run", "--preload", "server/patch.ts", "server/src/index.ts" ]
