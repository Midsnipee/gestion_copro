#!/usr/bin/env bash
# Sauvegarde nocturne de la base vers le NAS (dump cohérent, compressé) + rétention.
# Cron sur l'hôte : 30 2 * * * /chemin/gestion_copro/deploy/sauvegarde.sh /mnt/nas/sauvegardes/copro
# Restauration : gunzip -c copro_AAAA-MM-JJ.sql.gz | docker compose exec -T postgres psql -U copro -d copro
set -euo pipefail
DEST="${1:?Usage: sauvegarde.sh <dossier de destination>}"
RETENTION_JOURS="${RETENTION_JOURS:-30}"
cd "$(dirname "$0")"
mkdir -p "$DEST"
FICHIER="$DEST/copro_$(date +%Y-%m-%d_%H%M).sql.gz"
docker compose exec -T postgres pg_dump -U copro -d copro --clean --if-exists | gzip > "$FICHIER.part"
mv "$FICHIER.part" "$FICHIER"
# Clés de signature des sessions (sans elles, toutes les sessions sont à refaire)
docker compose cp api:/data/cles "$DEST/cles" >/dev/null
find "$DEST" -name 'copro_*.sql.gz' -mtime +"$RETENTION_JOURS" -delete
echo "Sauvegarde : $FICHIER"
