# Build & Dependencis
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# copy root workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/backend/package.json ./apps/backend/

# install dependencies 
RUN pnpm install --frozen-lockfile --filter @ctulib/backend...

# copy source code and build
COPY apps/backend ./apps/backend
RUN pnpm --filter @ctulib/backend build
RUN pnpm --filter @ctulib/backend --prod deploy /prod/api

# Runtime production
FROM node:20-alpine as runner
WORKDIR /app

USER node

COPY --from=builder --chown=node:node /prod/api ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD [ "node","dist/server.js" ]