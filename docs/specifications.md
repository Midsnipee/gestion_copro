# Immobilier Aline — Spécifications

Version du 2 novembre 2026 · Julien

> Document de référence. Toute modification des spécifications se fait ici, dans le repo.

## Contexte et objectifs

L'application centralise la gestion d'environ 100 copropriétés pour une gestionnaire de syndic, avec une IA qui rédige, lit les documents scannés et répond aux questions.

Elle tourne en local sur PC ou sur un serveur auto-hébergé, et reste utilisable hors ligne sur le terrain.

Objectifs :

- Retrouver en quelques secondes une information sur une copro (vote d'AG, contrat, prestataire, sinistre).
- Réduire le temps de rédaction des courriers, rapports de visite et PV.
- Suivre les demandes et les travaux de bout en bout, sans rien oublier.
- Garder la maîtrise des données (hébergement local, RGPD).

Utilisatrice cible : une gestionnaire (Aline), sur PC au bureau et sur tablette ou téléphone en visite.

## Périmètre fonctionnel : modules

Huit modules couvrent le quotidien du syndic ; l'IA (section suivante) s'appuie sur chacun.

| Module | Contenu | Hors ligne | Version |
| --- | --- | --- | --- |
| Copropriétés | Fiche immeuble, alias, lots, copropriétaires, conseil syndical, contrats, documents | Lecture + saisie | V1 |
| Demandes | Tickets (fuite, nuisance, sinistre…), statut, priorité, historique, relances | Lecture + saisie | V1 |
| Entreprises et devis | Annuaire par corps de métier, demande de devis multi-entreprises, comparatif | Lecture | V1 (annuaire), V2 (devis) |
| Courriers | Modèles Word, brouillon IA, validation, historique d'envoi | Saisie, génération IA différée | V1 |
| Visites | Checklist, photos, notes vocales, rapport PDF | Complet (cas clé) | V1 |
| Travaux | Besoin, devis, vote AG, ordre de service, suivi, réception | Lecture + saisie | V2 |
| Réunions et AG | Ordre du jour, présences, résolutions, votes, PV | Lecture + saisie | V2 |
| Tableau de bord | Échéances, relances, demandes ouvertes, toutes copros | Lecture | V3 |

Règle commune : chaque objet est rattaché à une copro, ce qui permet le filtrage partout et le ciblage du chatbot.

## Fonctions IA

Trois fonctions IA, toutes servies par des modèles cloud via OpenRouter, avec un modèle choisi par tâche.

### 1. Rédaction automatique

1. Aline choisit un type de document et le rattache à une copro, une demande, une visite ou une réunion.
2. Le système assemble le contexte : fiche copro, historique, notes, photos, documents liés.
3. Le LLM rédige le brouillon, injecté dans le modèle Word correspondant.
4. Aline relit, corrige, valide. Rien ne part sans validation.
5. Les courriers validés servent d'exemples pour caler le style (few-shot).

Types prévus : relance, mise en demeure, convocation, demande de devis, réponse à copropriétaire, rapport de visite, compte rendu de conseil syndical, PV d'AG.

Rapport de visite : notes vocales transcrites (Whisper local) puis structurées par l'IA en constats, photos légendées et actions.

### 2. Analyse des documents scannés

Chaque document importé passe par le pipeline d'ingestion (voir plus bas) : OCR, classification, extraction, indexation.

- Types reconnus : règlement de copropriété, PV d'AG, contrat, devis, facture, sinistre, courrier, plan, diagnostic.
- Données extraites vers la base : dates, montants, entreprises, résolutions et votes, échéances de contrat.
- Actions automatiques proposées : tâche « contrat qui expire dans 3 mois », rattachement d'un devis à une demande.
- Toute extraction reste modifiable et marquée « à vérifier » tant qu'Aline ne l'a pas confirmée.

### 3. Chatbot copro

- Détection de la copro visée (nom, adresse, alias) puis filtrage automatique ; possibilité d'interroger toutes les copros.
- RAG hybride : recherche vectorielle + mots-clés dans les documents, plus requêtes directes sur la base structurée (outils SQL en lecture seule).
- Chaque réponse cite ses sources : document, page, lien cliquable vers l'extrait.
- Réponse « je ne trouve pas » plutôt qu'une invention.

### Modèles par tâche (OpenRouter)

| Tâche | Gamme de modèle | Critère |
| --- | --- | --- |
| Rédaction courriers, rapports, PV | Haut de gamme (Claude Sonnet ou équivalent) | Qualité du français, ton |
| Chatbot RAG | Haut de gamme | Précision, citations |
| Classification, extraction | Rapide et peu cher | Volume |
| Scans illisibles | Modèle vision | Secours de l'OCR local |

Les modèles sont paramétrables dans l'admin, sans changer le code.

## Architecture technique et stack

Une seule base de code, un serveur PocketBase au centre, un worker Python pour l'IA, et un front PWA qui fonctionne hors ligne.

```mermaid
flowchart LR
    PC["PC (navigateur)"] --> Caddy
    Mobile["Tablette, mobile<br/>PWA hors ligne<br/>IndexedDB + outbox"] --> Caddy
    subgraph VM["Serveur : VM Proxmox, Docker"]
        Caddy["Caddy, reverse proxy HTTPS"] --> PB["PocketBase<br/>API, auth, front PWA<br/>SQLite : données, sqlite-vec, FTS5<br/>Fichiers : scans, photos"]
        PB <--> Worker["Worker IA (FastAPI)<br/>OCR, embeddings bge-m3, Whisper<br/>Pseudonymisation avant envoi<br/>File de tâches"]
    end
    PB --> NAS["NAS<br/>Sauvegarde nocturne"]
    Worker <--> OR["OpenRouter<br/>LLM cloud<br/>texte pseudonymisé"]
```

Les appareils ne parlent qu'au serveur ; seul le worker appelle OpenRouter, après pseudonymisation.

| Couche | Choix | Raison |
| --- | --- | --- |
| Front | SvelteKit en PWA | Installable, hors ligne, léger |
| Stockage local | IndexedDB (Dexie) + outbox | Saisie et photos sans réseau |
| Backend | PocketBase (Go, SQLite) | Binaire unique : API, auth, fichiers, admin |
| Recherche | sqlite-vec + FTS5 | Vectoriel et plein texte dans la même base |
| Worker IA | Python, FastAPI | Écosystème OCR et IA |
| OCR | Tesseract ou PaddleOCR | Local, gratuit |
| Embeddings | bge-m3 | Local, bon en français |
| Transcription | Whisper small ou medium | Local, sur CPU |
| LLM | OpenRouter | Un modèle par tâche, interchangeable |
| Documents | docxtemplater + PDF | Modèles Word d'Aline |

## Modèle de données

La copropriété est la racine : toute donnée y est rattachée, directement ou via une demande, un chantier ou une réunion.

| Collection | Champs principaux | Liée à |
| --- | --- | --- |
| copropriete | nom, alias[], adresse, nb lots, syndic depuis, notes | — |
| lot | numéro, type, tantièmes, étage | copropriete |
| personne | nom, rôle (copropriétaire, locataire, CS, gardien), coordonnées | copropriete, lot |
| entreprise | raison sociale, corps de métier, contacts, SIRET, assurance | — |
| contrat | objet, date début / fin, préavis, montant | copropriete, entreprise |
| demande | titre, catégorie, statut, priorité, demandeur, échéance | copropriete, personne |
| chantier | objet, statut, budget voté, dates | copropriete, demande, resolution |
| devis | montant HT / TTC, date, validité, statut | chantier ou demande, entreprise |
| courrier | type, destinataire, corps, statut (brouillon, validé, envoyé) | copropriete + objet source |
| visite | date, checklist, notes, transcription, rapport | copropriete |
| photo | fichier, légende, horodatage | visite ou demande |
| reunion | type (CS, AG), date, présents, ordre du jour, PV | copropriete |
| resolution | intitulé, majorité, résultat, votes | reunion |
| document | fichier, type, date, statut d'ingestion, texte OCR | copropriete + objet lié |
| chunk | texte, page, embedding (vecteur) | document |
| extraction | champ, valeur, confiance, vérifié | document |
| tache | titre, échéance, statut, origine (manuelle, IA) | tout objet |
| journal | action, objet, horodatage, auteur | tout objet |

Chaque enregistrement porte un identifiant unique (UUID), une date de modification et un indicateur de synchronisation, nécessaires au mode hors ligne.

## Pipeline d'ingestion documentaire

Chaque document passe par six étapes asynchrones, exécutées par le worker IA ; l'OCR et les embeddings tournent en local, seules la classification et l'extraction appellent OpenRouter.

1. **Import** : glisser-déposer, dossier surveillé ou scan direct ; la copro est choisie ou devinée à partir du contenu.
2. **OCR** : extraction du texte natif si le PDF en contient, sinon Tesseract ou PaddleOCR en local ; modèle vision en secours sur les pages illisibles.
3. **Classification** : le type de document est déduit des premières pages par un modèle peu cher.
4. **Extraction** : champs propres au type (dates, montants, résolutions, échéances), stockés avec un score de confiance et le statut « à vérifier ».
5. **Découpage et indexation** : passages de 500 à 800 tokens avec chevauchement, numéro de page conservé, embeddings bge-m3 en local, stockage dans sqlite-vec et index plein texte FTS5.
6. **Actions** : tâches proposées (échéance de contrat, relance), rattachement à une demande ou un chantier.

Volume estimé pour 100 copros : 50 000 à 150 000 pages, 50 à 200 Go de scans. Ingestion par vagues : d'abord règlements de copropriété et 3 derniers PV d'AG par copro, puis l'historique en tâche de nuit.

Coût : la classification ne lit que les premières pages, et l'extraction utilise un modèle bon marché ; le coût d'ingestion initiale reste à chiffrer sur un échantillon réel.

## Mode hors ligne et synchronisation

L'application reste utilisable sans réseau pour la consultation et la saisie ; tout ce qui demande l'IA est mis en file d'attente et traité au retour de la connexion.

| Fonction | En ligne | Hors ligne |
| --- | --- | --- |
| Consulter copros, contacts, demandes | Oui | Oui (copie locale) |
| Créer ou modifier une demande, une visite | Oui | Oui, synchronisé ensuite |
| Photos et notes vocales | Oui | Oui, envoyées ensuite |
| Consulter un document scanné | Oui | Seulement s'il a été mis en cache |
| Rédaction IA, chatbot | Oui | Non : demande mise en file |
| Import et analyse de documents | Oui | Non |

Principe technique :

- Le front (PWA) garde une copie locale dans IndexedDB via Dexie, par défaut les données de toutes les copros sans les fichiers.
- Chaque modification locale entre dans une file de synchronisation (outbox), rejouée vers PocketBase dès le retour du réseau.
- Conflits : une seule utilisatrice, donc « la dernière modification gagne », avec historique dans le journal pour revenir en arrière.
- Avant une visite, Aline peut « préparer la copro » : les documents clés de cette copro sont mis en cache sur l'appareil.

## Sécurité, RGPD, sauvegardes

Les données des copropriétaires restent sur le serveur ; seuls des textes pseudonymisés partent vers OpenRouter.

**Envoi vers l'IA cloud**

- Pseudonymisation avant chaque appel : noms, adresses, téléphones, e-mails, IBAN remplacés par des jetons (`[PERSONNE_12]`), ré-injectés au retour.
- OpenRouter configuré pour ne router que vers des fournisseurs sans rétention ni entraînement sur les données.
- Journal de chaque appel IA : date, tâche, modèle, volume de tokens, sans le contenu.

**Accès**

- Authentification PocketBase, mot de passe fort, accès distant uniquement via HTTPS (reverse proxy) ou VPN.
- Clé API OpenRouter stockée côté serveur, jamais dans le front.
- Données locales de l'appareil effaçables à distance par déconnexion du compte.

**RGPD**

- Registre de traitement à tenir par le cabinet ; l'application fournit l'export et la suppression des données d'une personne.
- Durées de conservation paramétrables par type de document.

**Sauvegardes**

- Base SQLite et fichiers sauvegardés chaque nuit vers le NAS, avec rétention 30 jours.
- Copie hors site chiffrée (règle 3-2-1).
- Test de restauration trimestriel.

## Infrastructure et déploiement

Cible recommandée : une VM sur le Proxmox, avec trois conteneurs Docker et des sauvegardes vers le NAS ; aucun GPU nécessaire puisque le LLM est dans le cloud.

| Ressource | Minimum | Recommandé |
| --- | --- | --- |
| vCPU | 4 | 8 |
| RAM | 16 Go | 32 Go |
| Stockage | SSD 500 Go | SSD 1 To |
| GPU | Aucun | Aucun |

Conteneurs (docker-compose) :

- `app` : PocketBase, qui sert aussi le front PWA compilé.
- `ai-worker` : FastAPI + file de tâches ; OCR, embeddings, Whisper, appels OpenRouter.
- `proxy` : Caddy pour le HTTPS automatique.

Mode PC : le même ensemble lancé via Docker Desktop sur le poste d'Aline, ou PocketBase seul avec un worker allégé. Le mode serveur reste recommandé pour 100 copros (volume de documents, sauvegardes, accès depuis la tablette).

Mises à jour : images versionnées, migration de schéma automatique au démarrage, sauvegarde forcée avant chaque mise à jour.

## Roadmap

Trois phases, chacune close par un critère d'usage réel plutôt qu'une date ; les durées seront fixées une fois les points ouverts levés.

```mermaid
flowchart LR
    V1["<b>V1 · Socle</b><br/>Fiches copros et contacts<br/>Annuaire entreprises<br/>Demandes et tâches<br/>Visites hors ligne, rapport<br/>Courriers : modèles + IA<br/><i>Fin : Aline utilise l'appli au quotidien sur 5 copros</i>"]
    V2["<b>V2 · Documents et IA</b><br/>Pipeline d'ingestion<br/>Chatbot avec sources<br/>Ingestion par vagues<br/>Travaux et devis<br/>Réunions, AG et PV<br/><i>Fin : chatbot juste et sourcé sur 20 questions test</i>"]
    V3["<b>V3 · Pilotage</b><br/>Tableau de bord global<br/>Relances automatiques<br/>Import logiciel de syndic<br/>Tâches proposées par l'IA<br/><i>Fin : toutes les copros suivies dans l'appli</i>"]
    V1 --> V2 --> V3
```

La V1 se teste sur 5 copros pilotes avant d'élargir ; l'ingestion massive des archives n'arrive qu'en V2, quand le pipeline est validé sur un échantillon.

## Points ouverts

- [ ] Volume réel de documents existants à numériser, et format actuel (papier, PDF, logiciel)
- [ ] Logiciel de syndic utilisé aujourd'hui : export ou import possible ?
- [ ] Modèles Word existants pour courriers, convocations et PV
- [ ] Aline seule utilisatrice, ou d'autres collaborateurs à prévoir ?
- [ ] Appareil de terrain : tablette Android, iPad ou téléphone ?
- [ ] Envoi des courriers : export PDF à envoyer à la main, ou envoi e-mail depuis l'application ?
- [ ] Budget mensuel acceptable pour les appels OpenRouter
- [ ] Accès distant : VPN ou exposition HTTPS publique ?
