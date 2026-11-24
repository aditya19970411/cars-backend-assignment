# ----------------------------------------------------
# Stage 1: Build & Dependencies
# ----------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /usr/src/app

# Install native compilation dependencies for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

# Prune devDependencies to keep production image lean
RUN yarn install --production --ignore-scripts --prefer-offline

# ----------------------------------------------------
# Stage 2: Production Runtime
# ----------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/usr/src/app/data/vehicles.sqlite \
    LOG_LEVEL=info

# Create persistent data directory and assign ownership to node user
RUN mkdir -p /usr/src/app/data && chown -R node:node /usr/src/app

COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist
COPY --chown=node:node --from=builder /usr/src/app/package.json ./
COPY --chown=node:node --from=builder /usr/src/app/yarn.lock ./

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main"]
