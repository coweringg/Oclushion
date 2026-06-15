# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
WORKDIR /workspace

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/sano-shield-proxy/package.json ./packages/sano-shield-proxy/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @oclushion/sano-shield-proxy...

FROM dependencies AS builder
COPY packages/sano-shield-proxy ./packages/sano-shield-proxy
COPY packages ./packages
RUN pnpm --filter @oclushion/sano-shield-proxy... build

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/sano-shield-proxy/package.json ./packages/sano-shield-proxy/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --filter @oclushion/sano-shield-proxy...

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 oclushion && adduser --system --uid 1001 --ingroup oclushion proxy
COPY --from=production-dependencies --chown=proxy:oclushion /workspace/node_modules ./node_modules
COPY --from=production-dependencies --chown=proxy:oclushion /workspace/packages/sano-shield-proxy/node_modules ./packages/sano-shield-proxy/node_modules
COPY --from=production-dependencies --chown=proxy:oclushion /workspace/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder --chown=proxy:oclushion /workspace/packages/sano-shield-proxy/dist ./packages/sano-shield-proxy/dist
COPY --from=builder --chown=proxy:oclushion /workspace/packages/sano-shield-proxy/package.json ./packages/sano-shield-proxy/package.json
COPY --from=builder --chown=proxy:oclushion /workspace/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=proxy:oclushion /workspace/packages/shared/package.json ./packages/shared/package.json
USER proxy
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "--import", "./packages/sano-shield-proxy/dist/instrumentation.js", "packages/sano-shield-proxy/dist/server.js"]
