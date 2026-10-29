# Build & Dependencis
FROM node:22-apline AS builder
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# copy root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/backend/package.json ./apps/api/

# install dependencies 
RUN pnpm install --frozen-lockfile -filter @ctulib/backed...

# copy source code and build
COPY apps/backend ./apps/api
RUN pnpm --filter @ctulib/api build
RUN pnpm --filter @ctulib/api --prod deploy /prod/api

# Runtime production
FROM node:20-alpine as runner
WORKDIR /app

USER node

COPY --from=builder --chown=node:node /prod/api ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD [ "node","dist/server.js" ]