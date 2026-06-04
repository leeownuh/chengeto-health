FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

# Use the lockfile for deterministic frontend builds.
RUN npm ci --legacy-peer-deps

COPY . .

ARG VITE_API_URL
ARG VITE_SOCKET_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN npm run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY docker-server.js ./docker-server.js
COPY --from=build /app/dist ./dist

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "docker-server.js"]
