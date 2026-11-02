# Gestion copro — Immobilier Aline

Application de gestion de syndic de copropriété (~100 copros) : demandes, travaux, devis, courriers, visites, réunions et AG, avec IA de rédaction, analyse des documents scannés et chatbot.

- Local-first : fonctionne sur PC ou serveur auto-hébergé, utilisable hors ligne (PWA).
- Stack prévue : PocketBase (SQLite + sqlite-vec) · SvelteKit PWA · worker IA Python (FastAPI) · LLM via OpenRouter.

## Documentation

- [Spécifications](docs/specifications.md)

## Arborescence prévue

```
docs/        spécifications et décisions
app/         PocketBase + migrations
web/         front SvelteKit (PWA)
ai-worker/   OCR, embeddings, RAG, rédaction
deploy/      docker-compose, Caddy, sauvegardes
```
