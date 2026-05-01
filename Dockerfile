# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_CONVEX_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-slim

WORKDIR /app

ENV VITE_CLERK_PUBLISHABLE_KEY=""
ENV VITE_CONVEX_URL=""

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server/server.js"]
