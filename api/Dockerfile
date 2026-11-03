# Construit depuis la racine du repo (monorepo npm : shared + api)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci --workspace api
COPY shared shared
COPY api api
RUN npm run build -w api && npm ci --workspace api --omit=dev

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/api/dist api/dist
COPY --from=build /app/api/migrations api/migrations
COPY --from=build /app/api/package.json api/
WORKDIR /app/api
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
