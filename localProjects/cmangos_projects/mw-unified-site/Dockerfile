FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Prepare minimal node_modules for prewarm script
RUN mkdir -p /prewarm-deps && cd /prewarm-deps && \
    echo '{"dependencies":{"mysql2":"*"}}' > package.json && \
    cp /app/package-lock.json . 2>/dev/null || true && \
    npm install --production mysql2 2>/dev/null || npm install mysql2

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Docker CLI for admin server management
RUN apk add --no-cache docker-cli docker-cli-compose

# Copy built output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy prewarm deps + scripts
COPY --from=builder /prewarm-deps/node_modules ./scripts/node_modules
COPY --from=builder /app/scripts/prewarm-icons.mjs ./scripts/prewarm-icons.mjs
COPY --from=builder /app/scripts/entrypoint.sh ./scripts/entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "scripts/entrypoint.sh"]
