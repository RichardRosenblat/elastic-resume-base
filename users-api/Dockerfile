FROM node:20-alpine AS builder
WORKDIR /app

# Copy shared libraries first so they can be referenced by the service
COPY shared/Synapse ./shared/Synapse
COPY shared/Bugle ./shared/Bugle

# Copy users-api package manifests and install dependencies
COPY users-api/package*.json ./users-api/
WORKDIR /app/users-api
RUN npm ci

# Copy source and build
COPY users-api/tsconfig.json ./
COPY users-api/src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# Copy shared libraries for runtime reference
COPY shared/Synapse /app/shared/Synapse
COPY shared/Bugle /app/shared/Bugle

ENV NODE_ENV=production
WORKDIR /app/users-api
COPY users-api/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/users-api/dist ./dist

EXPOSE 8005
USER node
CMD ["node", "dist/server.js"]
