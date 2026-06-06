FROM node:22-alpine AS build

WORKDIR /app

# Native modules need a basic build toolchain on Alpine.
RUN apk add --no-cache python3 make g++ git

COPY package*.json ./

ENV NODE_ENV=production

# Use the lockfile for deterministic production installs.
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

COPY . .

RUN mkdir -p logs uploads

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/config ./config
COPY --from=build /app/routes ./routes
COPY --from=build /app/middleware ./middleware
COPY --from=build /app/models ./models
COPY --from=build /app/services ./services
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/utils ./utils

RUN mkdir -p logs uploads && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]
