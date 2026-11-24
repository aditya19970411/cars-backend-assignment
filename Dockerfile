# ----------------------------------------------------
# Stage 1: Build & Dependencies
# ----------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

# Prune devDependencies to keep production image lean
RUN yarn install --production --ignore-scripts --prefer-offline

# ----------------------------------------------------
# Stage 2: Production Runtime
# ----------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_HOST=postgres \
    DATABASE_PORT=5432 \
    DATABASE_USER=postgres \
    DATABASE_NAME=cars_db \
    DATABASE_SSL=false \
    LOG_LEVEL=info

RUN chown -R node:node /usr/src/app

COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist
COPY --chown=node:node --from=builder /usr/src/app/package.json ./
COPY --chown=node:node --from=builder /usr/src/app/yarn.lock ./

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main"]
