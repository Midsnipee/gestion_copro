# Image unique : front PWA compilé + PocketBase qui le sert.
# Construite depuis la racine du repo (voir deploy/docker-compose.yml).

FROM node:22-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM alpine:3.20
ARG PB_VERSION=0.40.6
ARG TARGETARCH=amd64
RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip -O /tmp/pb.zip \
 && unzip /tmp/pb.zip -d /pb && rm /tmp/pb.zip
COPY app/pb_migrations /pb/pb_migrations
COPY app/pb_hooks /pb/pb_hooks
COPY --from=web /web/build /pb/pb_public
EXPOSE 8090
VOLUME /pb/pb_data
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations", "--hooksDir=/pb/pb_hooks", "--publicDir=/pb/pb_public"]
