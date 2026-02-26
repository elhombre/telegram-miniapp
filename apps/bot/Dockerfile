FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml turbo.json biome.json ./
COPY scripts ./scripts
COPY packages ./packages
COPY apps ./apps

RUN sh ./scripts/docker/enable-node-modules-linker.sh
RUN yarn install --immutable
RUN yarn workspace bot build
RUN yarn ncc build apps/bot/dist/main.js -o apps/bot/dist-ncc -m -s

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/bot/dist-ncc ./apps/bot/dist-ncc

EXPOSE 3200

CMD ["node", "--enable-source-maps", "apps/bot/dist-ncc/index.js"]
