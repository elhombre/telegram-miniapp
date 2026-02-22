FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml turbo.json biome.json ./
COPY scripts ./scripts
COPY packages ./packages
COPY apps ./apps

RUN sh ./scripts/docker/enable-node-modules-linker.sh
RUN yarn install --immutable
RUN yarn workspace backend build
RUN yarn ncc build apps/backend/dist/main.js -o apps/backend/dist-ncc -m -s -e @prisma/client -e prisma -e .prisma/client -e argon2 -e '@nestjs/websockets*' -e '@nestjs/microservices*' -e @grpc/grpc-js -e kafkajs -e mqtt -e nats -e amqplib -e amqp-connection-manager -e @nestjs/platform-socket.io
RUN yarn workspaces focus backend --production

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist-ncc ./apps/backend/dist-ncc
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/apps/backend/prisma.config.ts ./apps/backend/prisma.config.ts

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --config ./apps/backend/prisma.config.ts && node apps/backend/dist-ncc/index.js"]
