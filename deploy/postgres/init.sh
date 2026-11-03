#!/bin/sh
# Exécuté une seule fois, à la création du volume Postgres.
# Crée le rôle de réplication de PowerSync et sa base de stockage.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE powersync WITH LOGIN REPLICATION PASSWORD '${PS_PASSWORD}';
CREATE DATABASE powersync_storage OWNER powersync;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync;
ALTER DEFAULT PRIVILEGES FOR ROLE "${POSTGRES_USER}" IN SCHEMA public GRANT SELECT ON TABLES TO powersync;
SQL
