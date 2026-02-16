FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build the app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image for the Next.js app
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy migrations and runner script so we can run migrations on startup
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
# Standalone may omit these; migrate.cjs needs pg+drizzle-orm, server needs proxy packages
COPY --from=builder /app/node_modules/pg ./node_modules/pg
COPY --from=builder /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder /app/node_modules/node-fetch ./node_modules/node-fetch
COPY --from=builder /app/node_modules/socks-proxy-agent ./node_modules/socks-proxy-agent
COPY --from=builder /app/node_modules/https-proxy-agent ./node_modules/https-proxy-agent
COPY --from=builder /app/node_modules/socks ./node_modules/socks
COPY --from=builder /app/node_modules/agent-base ./node_modules/agent-base
COPY --from=builder /app/node_modules/smart-buffer ./node_modules/smart-buffer
COPY --from=builder /app/node_modules/ip-address ./node_modules/ip-address
COPY --from=builder /app/node_modules/data-uri-to-buffer ./node_modules/data-uri-to-buffer
COPY --from=builder /app/node_modules/fetch-blob ./node_modules/fetch-blob
COPY --from=builder /app/node_modules/formdata-polyfill ./node_modules/formdata-polyfill
COPY --from=builder /app/node_modules/web-streams-polyfill ./node_modules/web-streams-polyfill
COPY --from=builder /app/node_modules/node-domexception ./node_modules/node-domexception
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Run migrations then start the server (migrate.cjs uses DATABASE_URL from env)
CMD ["sh", "-c", "node scripts/migrate.cjs && node server.js"]

# Worker image
FROM base AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx tsc --project tsconfig.worker.json || true
CMD ["node", "--import", "tsx", "src/worker/poll.ts"]
