FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml turbo.json biome.json ./
COPY .yarn ./.yarn
COPY packages ./packages
COPY apps ./apps

RUN yarn install --immutable
RUN yarn workspace bot build

EXPOSE 3200

CMD ["yarn", "workspace", "bot", "start"]
