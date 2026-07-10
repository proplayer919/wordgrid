FROM oven/bun:1 AS production
WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .

USER bun

EXPOSE 3000/tcp
EXPOSE 3001/tcp

ENTRYPOINT [ "bun", "run", "--preload", "./patch.ts", "src/index.ts" ]
