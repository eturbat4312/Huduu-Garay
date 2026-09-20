FROM node:20.19.4-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package*.json ./
COPY .env.local .env.local

RUN npm ci

COPY . .

RUN npm run build

# Production image
FROM node:20.19.4-alpine AS runner

WORKDIR /app

ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.env.local .env.local

RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next .env.local

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
