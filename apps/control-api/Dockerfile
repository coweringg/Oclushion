# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
WORKDIR /workspace

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/control-api/package.json ./apps/control-api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/connectors/package.json ./packages/connectors/package.json
COPY packages/config/package.json ./packages/config/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @oclushion/control-api...

FROM dependencies AS builder
COPY packages/shared ./packages/shared
COPY packages/connectors ./packages/connectors
COPY packages/config ./packages/config
COPY apps/control-api ./apps/control-api
RUN pnpm --filter @oclushion/control-api build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV CONTROL_API_HOST=0.0.0.0
ENV CONTROL_API_PORT=8082
RUN addgroup --system --gid 1001 oclushion && adduser --system --uid 1001 --ingroup oclushion controlapi
COPY --from=builder --chown=controlapi:oclushion /workspace/apps/control-api/dist ./dist
COPY --from=builder --chown=controlapi:oclushion /workspace/apps/control-api/sql ./sql
COPY --from=builder --chown=controlapi:oclushion /workspace/packages/shared/dist ./node_modules/@oclushion/shared/dist
COPY --from=builder --chown=controlapi:oclushion /workspace/packages/connectors/dist ./node_modules/@oclushion/connectors/dist
COPY --from=builder --chown=controlapi:oclushion /workspace/node_modules ./node_modules
USER controlapi
EXPOSE 8082
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:8082/health || exit 1
CMD ["node", "--import", "./dist/instrumentation.js", "dist/server.js"]
