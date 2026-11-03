# Gestion copro — Immobilier Aline

Application de gestion de syndic de copropriété (~100 copros) : demandes, travaux, devis, courriers, visites, réunions et AG, avec IA de rédaction, analyse des documents scannés et chatbot.

- Local-first : fonctionne sur PC ou serveur auto-hébergé, utilisable hors ligne (PWA).
- Stack : PocketBase (SQLite) · SvelteKit PWA + Dexie · worker IA Python (FastAPI) · LLM via OpenRouter · Caddy.

Référence fonctionnelle et technique : [docs/specifications.md](docs/specifications.md).

## État actuel (squelette V1)

| Partie | Fait | À venir |
| --- | --- | --- |
| Base de données | Schéma complet des 17 collections (`app/pb_migrations`) | — |
| Front PWA | Connexion, liste et recherche des copros, fiche copro, demandes, rédaction de courrier IA, synchro hors ligne, cache de l'appli | Lots, contacts, entreprises, visites, export Word/PDF |
| Worker IA | Rédaction de courriers avec pseudonymisation, authentification par la session PocketBase | Ingestion des scans, chatbot RAG, transcription |
| Déploiement | docker-compose, Caddy, sauvegarde vers le NAS | — |

## Démarrage sur le serveur

```bash
git clone https://github.com/Midsnipee/gestion_copro && cd gestion_copro/deploy
cp .env.example .env          # renseigner OPENROUTER_API_KEY, DOMAINE
docker compose up -d --build

# Compte administrateur PocketBase (une fois)
docker compose exec app /pb/pocketbase superuser upsert admin@exemple.fr 'MotDePasseFort'
```

Puis, dans l'admin PocketBase (`http://<serveur>/_/`) :

1. Collection **users** : créer le compte d'Aline (e-mail + mot de passe).
2. **Settings > Backups** : activer les sauvegardes automatiques (cron `0 2 * * *`, garder 7).
3. Sur l'hôte, planifier la copie vers le NAS : `30 2 * * * /chemin/gestion_copro/deploy/sauvegarde.sh /mnt/nas/sauvegardes/copro`

Aline ouvre ensuite `http://<serveur>/` et installe l'application depuis le navigateur (« Installer » / « Ajouter à l'écran d'accueil »). L'installation PWA et le hors ligne exigent HTTPS, sauf sur `localhost` : en dehors du poste local, renseigner `DOMAINE` ou passer par un VPN avec certificat.

## Développement

```bash
# PocketBase (binaire depuis https://github.com/pocketbase/pocketbase/releases, v0.40+)
cd app && pocketbase serve --migrationsDir=pb_migrations --hooksDir=pb_hooks

# Worker IA
cd ai-worker && python -m venv .venv && .venv/bin/pip install -e '.[dev]'
PB_URL=http://127.0.0.1:8090 OPENROUTER_API_KEY=... .venv/bin/uvicorn app.main:app --port 8000
.venv/bin/pytest

# Front (proxy /api -> :8090 et /ia -> :8000)
cd web && npm install && npm run dev
```

## Arborescence

```
docs/        spécifications (référence)
app/         PocketBase : migrations, hooks, Dockerfile (embarque le front compilé)
web/         front SvelteKit PWA (Dexie + file d'envoi hors ligne)
ai-worker/   FastAPI : rédaction, pseudonymisation, client OpenRouter
deploy/      docker-compose, Caddyfile, .env.example, sauvegarde.sh
```
