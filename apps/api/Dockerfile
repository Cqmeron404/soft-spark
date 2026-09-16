# Soft Spark API — Node 22 (preferred over serverless for SSE + match jobs)
FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY apps/realtime/package.json apps/realtime/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/match-engine/package.json packages/match-engine/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @soft-spark/api... build
ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787
CMD ["pnpm", "--filter", "@soft-spark/api", "start"]
