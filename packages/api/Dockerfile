# syntax=docker/dockerfile:1
#
# Build context is the REPOSITORY ROOT, not packages/api:
#
#   docker build -f packages/api/Dockerfile -t vibesafe-api .
#
# @vibesafe/api is an npm workspace that depends on @vibesafe/shared, and the
# lockfile lives at the root, so packages/api on its own is not a buildable unit.
#
# The previous version of this file assumed a context of packages/api and did
# `COPY dist/ ./dist/`, but packages/api/dist is gitignored and is a TypeScript
# build output. From a clean checkout that path does not exist, so the image
# could never be built - only from a working tree where someone had already run
# `npm run build` by hand. This compiles inside the image instead.

# ---- build -------------------------------------------------------------------
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY packages ./packages

RUN npm ci
RUN npm run build --workspace @vibesafe/shared \
 && npm run build --workspace @vibesafe/api

# ---- runtime -----------------------------------------------------------------
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# node_modules is copied wholesale so the @vibesafe/shared workspace symlink
# stays intact; the package directories it points at are copied below.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

COPY --from=build /app/packages/api/package.json ./packages/api/package.json
COPY --from=build /app/packages/api/dist ./packages/api/dist

EXPOSE 3001
CMD ["node", "packages/api/dist/index.js"]
