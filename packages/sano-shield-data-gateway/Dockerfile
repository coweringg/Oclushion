# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
WORKDIR /workspace

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/sano-shield-data-gateway/package.json ./packages/sano-shield-data-gateway/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/sano-shield-data-protect/package.json ./packages/sano-shield-data-protect/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @oclushion/sano-shield-data-gateway...

FROM dependencies AS builder
COPY packages/sano-shield-data-gateway ./packages/sano-shield-data-gateway
COPY packages ./packages
RUN pnpm --filter @oclushion/sano-shield-data-gateway... build

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/sano-shield-data-gateway/package.json ./packages/sano-shield-data-gateway/package.json
COPY packages/sano-shield-data-protect/package.json ./packages/sano-shield-data-protect/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --filter @oclushion/sano-shield-data-gateway...

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 oclushion && adduser --system --uid 1001 --ingroup oclushion datagateway
COPY --from=production-dependencies --chown=datagateway:oclushion /workspace/node_modules ./node_modules
COPY --from=production-dependencies --chown=datagateway:oclushion /workspace/packages/sano-shield-data-gateway/node_modules ./packages/sano-shield-data-gateway/node_modules
COPY --from=production-dependencies --chown=datagateway:oclushion /workspace/packages/sano-shield-data-protect/node_modules ./packages/sano-shield-data-protect/node_modules
COPY --from=builder --chown=datagateway:oclushion /workspace/packages/sano-shield-data-gateway/dist ./packages/sano-shield-data-gateway/dist
COPY --from=builder --chown=datagateway:oclushion /workspace/packages/sano-shield-data-gateway/package.json ./packages/sano-shield-data-gateway/package.json
COPY --from=builder --chown=datagateway:oclushion /workspace/packages/sano-shield-data-protect/dist ./packages/sano-shield-data-protect/dist
COPY --from=builder --chown=datagateway:oclushion /workspace/packages/sano-shield-data-protect/package.json ./packages/sano-shield-data-protect/package.json
COPY --from=builder --chown=datagateway:oclushion /workspace/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=datagateway:oclushion /workspace/packages/shared/package.json ./packages/shared/package.json
USER datagateway
EXPOSE 8083
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8083/health/live').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "packages/sano-shield-data-gateway/dist/server.js"]
