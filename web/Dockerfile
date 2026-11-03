# Construit depuis la racine du repo : compile la PWA puis la sert avec Caddy
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci --workspace web
COPY shared shared
COPY web web
RUN npm run build -w web

FROM caddy:2-alpine
COPY --from=build /app/web/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
