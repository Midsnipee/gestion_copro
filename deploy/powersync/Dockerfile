# Service PowerSync (édition open source), version testée avec ce projet.
# Alternative : l'image officielle journeyapps/powersync-service.
FROM node:24-slim
ARG POWERSYNC_VERSION=1.28.0
WORKDIR /srv
RUN npm init -y >/dev/null && npm install --omit=dev @powersync/service-image@${POWERSYNC_VERSION} && npm cache clean --force
COPY powersync.yaml sync-config.yaml ./
EXPOSE 8080
CMD ["node", "node_modules/@powersync/service-image/lib/entry.js", "start", "-r", "unified", "-c", "powersync.yaml"]
