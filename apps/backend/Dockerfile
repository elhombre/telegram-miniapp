FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml turbo.json biome.json ./
COPY packages ./packages
COPY apps ./apps

RUN yarn install --immutable
RUN yarn workspace backend build

EXPOSE 3000

CMD ["sh", "-c", "yarn workspace backend prisma:migrate:deploy && yarn workspace backend start:prod"]
