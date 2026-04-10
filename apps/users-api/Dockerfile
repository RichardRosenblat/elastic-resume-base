FROM node:22-alpine AS builder
WORKDIR /app

# Copy shared libraries first so they can be referenced by the service
COPY shared/Synapse ./shared/Synapse
COPY shared/Bugle ./shared/Bugle
COPY shared/Bowltie ./shared/Bowltie

# Copy users-api package manifests and install dependencies
COPY apps/users-api/package*.json ./apps/users-api/
WORKDIR /app/apps/users-api
RUN npm ci

# Copy source and build
COPY apps/users-api/tsconfig.json ./
COPY apps/users-api/src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

# Copy shared libraries for runtime reference
COPY shared/Synapse /app/shared/Synapse
COPY shared/Bugle /app/shared/Bugle
COPY shared/Bowltie /app/shared/Bowltie

ENV NODE_ENV=production
WORKDIR /app/apps/users-api
COPY apps/users-api/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/apps/users-api/dist ./dist

EXPOSE 8005
USER node
CMD ["node", "dist/server.js"]
