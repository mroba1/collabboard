FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
RUN npm ci --workspace=packages/shared --workspace=packages/server --include-workspace-root

FROM deps AS build
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY tsconfig.base.json ./
RUN npm run build:shared
RUN npm run --workspace=packages/server prisma:generate
RUN npm run build:server

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/server/prisma packages/server/prisma
COPY --from=build /app/packages/server/package.json packages/server/package.json

WORKDIR /app/packages/server
EXPOSE 4000
CMD ["node", "dist/index.js"]
