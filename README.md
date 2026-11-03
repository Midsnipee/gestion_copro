# Gestion copro — Immobilier Aline

Application de gestion de syndic de copropriété (~100 copros) : demandes, travaux, devis, courriers, visites, réunions et AG, avec IA de rédaction, analyse des documents scannés et chatbot.

- Hors ligne d'abord : chaque appareil (PC, tablette, téléphone) lit et écrit dans sa propre base SQLite ; PowerSync synchronise avec PostgreSQL au retour du réseau.
- Plusieurs appareils peuvent modifier les mêmes fiches : les modifications concurrentes sont détectées et soumises à l'utilisatrice, jamais écrasées en silence.
- Stack : React + Vite (PWA) · PowerSync Web + SQLite · API Fastify + TypeScript · PostgreSQL · worker IA Python (OpenRouter) · Docker Compose + Caddy.

Référence fonctionnelle et technique : [docs/specifications.md](docs/specifications.md).

## État actuel (squelette V1)

| Partie | Fait | À venir |
| --- | --- | --- |
| Base de données | Schéma PostgreSQL complet (18 tables), publication pour PowerSync | — |
| API | Sessions JWT + renouvellement, envoi des écritures avec contrôle de version et consignation des conflits, rédaction IA | Fichiers (scans, photos), export Word/PDF |
| Front PWA | Connexion, copros, demandes, rédaction de courrier IA, statut « Sur cet appareil » / « Synchronisé », écran Conflits | Lots, contacts, entreprises, visites |
| Worker IA | Rédaction avec pseudonymisation | Ingestion des scans, chatbot RAG, transcription |
| Déploiement | docker-compose (5 services), sauvegarde vers le NAS | — |

## Démarrage sur le serveur

```bash
git clone https://github.com/Midsnipee/gestion_copro && cd gestion_copro/deploy
cp .env.example .env     # renseigner DOMAINE, PG_PASSWORD, PS_PASSWORD, OPENROUTER_API_KEY
docker compose up -d --build

# Compte d'Aline (mot de passe demandé, 12 caractères min.)
docker compose exec api node dist/cli.js utilisateur aline@exemple.fr "Aline"
```

Aline ouvre ensuite `https://<DOMAINE>/` et installe l'application depuis le navigateur. L'installation et le hors ligne exigent HTTPS (sauf `localhost`) : renseigner `DOMAINE` avec un nom qui pointe vers le serveur (Caddy obtient le certificat), ou passer par un VPN avec certificat.

Sauvegarde nocturne vers le NAS, sur l'hôte :

```
30 2 * * * /chemin/gestion_copro/deploy/sauvegarde.sh /mnt/nas/sauvegardes/copro
```

## Développement

Prérequis : Node 22, Python 3.12, un PostgreSQL 17 avec `wal_level=logical`.

```bash
npm install

# API (applique les migrations au démarrage)
DATABASE_URL=postgres://... npm run dev -w api
npm test                                   # tests API contre un vrai Postgres (TEST_DATABASE_ADMIN_URL)

# Service PowerSync : voir deploy/powersync (Node 24 ou image Docker)

# Worker IA
cd ai-worker && python -m venv .venv && .venv/bin/pip install -e '.[dev]' && .venv/bin/pytest

# Front (proxy /api -> :3000, /powersync -> :8080)
npm run dev -w web
```

## Arborescence

```
docs/        spécifications (référence)
shared/      définition des tables, partagée par l'API et le front
api/         Fastify : migrations SQL, sessions, envoi des écritures, conflits, IA
web/         PWA React + PowerSync
ai-worker/   FastAPI : pseudonymisation, appels OpenRouter
deploy/      docker-compose, Caddyfile, PowerSync, init Postgres, sauvegarde
```
