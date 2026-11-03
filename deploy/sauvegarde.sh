#!/usr/bin/env bash
# Copie les sauvegardes PocketBase vers le NAS et applique la rétention.
#
# Prérequis (une fois) : admin PocketBase > Settings > Backups
#   - Auto backups : activé, cron "0 2 * * *", garder 7 sauvegardes
#   PocketBase produit alors chaque nuit un zip cohérent (base + fichiers) dans pb_data/backups.
#
# Cron sur l'hôte : 30 2 * * * /chemin/gestion_copro/deploy/sauvegarde.sh /mnt/nas/sauvegardes/copro
set -euo pipefail
DEST="${1:?Usage: sauvegarde.sh <dossier de destination>}"
RETENTION_JOURS="${RETENTION_JOURS:-30}"
cd "$(dirname "$0")"

mkdir -p "$DEST"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
docker compose cp app:/pb/pb_data/backups/. "$TMP/"
cp -n "$TMP"/*.zip "$DEST"/ 2>/dev/null || { echo "Aucune sauvegarde trouvée : activer les auto backups dans PocketBase" >&2; exit 1; }
find "$DEST" -name '*.zip' -mtime +"$RETENTION_JOURS" -delete
echo "Sauvegardes à jour dans $DEST : $(ls "$DEST"/*.zip | wc -l) fichier(s)"
