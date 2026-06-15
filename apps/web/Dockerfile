# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
WORKDIR /workspace

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/config/package.json ./packages/config/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @oclushion/web...

FROM dependencies AS builder
COPY apps/web ./apps/web
COPY packages/config ./packages/config
RUN pnpm --filter @oclushion/web build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
RUN addgroup --system --gid 1001 oclushion && adduser --system --uid 1001 --ingroup oclushion nextjs
COPY --from=builder --chown=nextjs:oclushion /workspace/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:oclushion /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:oclushion /workspace/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:3000/health || exit 1
CMD ["node", "apps/web/server.js"]
