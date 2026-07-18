ARG CACHEBUST=1
FROM oven/bun:canary AS production
WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY server/package.json server/bun.lock ./server/
WORKDIR /usr/src/app/server
RUN bun install --frozen-lockfile --production

WORKDIR /usr/src/app

COPY server/ ./server/
COPY common/ ./common/

USER bun

ENTRYPOINT [ "bun", "server/src/index.ts" ]
