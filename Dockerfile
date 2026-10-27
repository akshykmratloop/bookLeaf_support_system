# One image: the API serves the built web app on the same origin (no CORS, first-party cookies).
# Build:  docker build -t bookleaf .
# Run:    docker run -p 3000:3000 --env-file .env bookleaf
# Migrations run before the server starts (`prisma migrate deploy`, never `db push`).

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/host-demo/package.json apps/host-demo/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @bookleaf/web build && pnpm --filter @bookleaf/api build
RUN pnpm deploy --filter @bookleaf/api --prod --legacy /out && cp -r apps/api/dist /out/dist && cp -r apps/web/dist /out/web

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production WEB_DIST_DIR=/app/web PORT=3000
COPY --from=build /out /app
RUN npx prisma generate
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
