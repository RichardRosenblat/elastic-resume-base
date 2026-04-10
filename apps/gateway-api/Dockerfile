FROM node:22-alpine AS builder
WORKDIR /app

# Copy shared TS libraries so npm can resolve the file: references in
# package.json and esbuild can bundle @shared/toolbox.
COPY shared/Toolbox/v1/toolbox_ts/ ./shared/Toolbox/v1/toolbox_ts/
COPY shared/Aegis/v2/aegis_ts/ ./shared/Aegis/v2/aegis_ts/
COPY shared/Bowltie/v1/bowltie_ts/ ./shared/Bowltie/v1/bowltie_ts/
COPY shared/Harbor/v3/harbor_ts/ ./shared/Harbor/v3/harbor_ts/

# Copy gateway-api package manifests and install dependencies.
COPY apps/gateway-api/package*.json ./apps/gateway-api/
WORKDIR /app/apps/gateway-api
RUN npm ci

# Copy source files and build.
COPY apps/gateway-api/tsconfig.json ./
COPY apps/gateway-api/esbuild.config.mjs ./
COPY apps/gateway-api/src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

# Copy shared TS libraries required at runtime (node_modules symlinks point here).
COPY shared/Aegis/v2/aegis_ts/ ./shared/Aegis/v2/aegis_ts/
COPY shared/Bowltie/v1/bowltie_ts/ ./shared/Bowltie/v1/bowltie_ts/
COPY shared/Harbor/v3/harbor_ts/ ./shared/Harbor/v3/harbor_ts/

ENV NODE_ENV=production
WORKDIR /app/apps/gateway-api
COPY apps/gateway-api/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/apps/gateway-api/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]
