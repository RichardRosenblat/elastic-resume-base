# Multi-stage build for the React frontend
# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build args for VITE_ env vars (passed at build time)
# Note: branding (company name, logos, colours, fonts) is configured in
# src/theme/theme.json (template) and optional src/theme/theme.local.json.
ARG VITE_GATEWAY_URL="http://localhost:3000"
ARG VITE_SUPPORT_EMAIL=""
ARG VITE_FIREBASE_API_KEY=""
ARG VITE_FIREBASE_AUTH_DOMAIN=""
ARG FIREBASE_PROJECT_ID="demo-elastic-resume-base"
ARG VITE_FEATURE_RESUME_INGEST="false"
ARG VITE_FEATURE_RESUME_SEARCH="false"
ARG VITE_FEATURE_DOCUMENT_READ="false"
ARG VITE_FEATURE_RESUME_GENERATE="false"
ARG VITE_FEATURE_USER_MANAGEMENT="true"

# Set build env vars
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL
ENV VITE_SUPPORT_EMAIL=$VITE_SUPPORT_EMAIL
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
ENV VITE_FEATURE_RESUME_INGEST=$VITE_FEATURE_RESUME_INGEST
ENV VITE_FEATURE_RESUME_SEARCH=$VITE_FEATURE_RESUME_SEARCH
ENV VITE_FEATURE_DOCUMENT_READ=$VITE_FEATURE_DOCUMENT_READ
ENV VITE_FEATURE_RESUME_GENERATE=$VITE_FEATURE_RESUME_GENERATE
ENV VITE_FEATURE_USER_MANAGEMENT=$VITE_FEATURE_USER_MANAGEMENT

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
