/// <reference path="../pb_data/types.d.ts" />

// Schéma initial — voir docs/specifications.md, section « Modèle de données ».
// Les embeddings (chunks) ne sont pas ici : ils vivent dans l'index du worker IA.

const AUTH = "@request.auth.id != ''";

const COLLECTIONS = [
  ["copropriete", (c) => [
    text("nom", { required: true, presentable: true }),
    json("alias"),
    text("adresse", { required: true }),
    text("code_postal"),
    text("ville"),
    num("nb_lots", { onlyInt: true }),
    date("syndic_depuis"),
    editor("notes"),
  ]],
  ["lot", (c) => [
    rel("copropriete", c.copropriete, { required: true, cascadeDelete: true }),
    text("numero", { required: true, presentable: true }),
    sel("type", ["appartement", "commerce", "parking", "cave", "bureau", "autre"]),
    num("tantiemes", { onlyInt: true }),
    text("etage"),
  ]],
  ["personne", (c) => [
    rel("copropriete", c.copropriete, { required: true }),
    rel("lots", c.lot, { maxSelect: 50 }),
    text("nom", { required: true, presentable: true }),
    text("prenom"),
    sel("role", ["coproprietaire", "locataire", "conseil_syndical", "president_cs", "gardien", "autre"], { maxSelect: 3 }),
    email("email"),
    text("telephone"),
    text("adresse_postale"),
    editor("notes"),
  ]],
  ["entreprise", (c) => [
    text("raison_sociale", { required: true, presentable: true }),
    sel("corps_metier", ["plomberie", "electricite", "ascenseur", "toiture", "maconnerie", "peinture", "menuiserie", "serrurerie", "chauffage", "nettoyage", "espaces_verts", "desinsectisation", "multiservice", "autre"], { maxSelect: 5 }),
    text("contact"),
    email("email"),
    text("telephone"),
    text("siret"),
    date("assurance_fin"),
    editor("notes"),
  ]],
  ["contrat", (c) => [
    rel("copropriete", c.copropriete, { required: true, cascadeDelete: true }),
    rel("entreprise", c.entreprise),
    text("objet", { required: true, presentable: true }),
    date("date_debut"),
    date("date_fin"),
    num("preavis_mois", { onlyInt: true }),
    num("montant_annuel_ttc"),
  ]],
  ["demande", (c) => [
    rel("copropriete", c.copropriete, { required: true }),
    rel("demandeur", c.personne),
    text("titre", { required: true, presentable: true }),
    editor("description"),
    sel("categorie", ["fuite", "nuisance", "sinistre", "entretien", "travaux", "administratif", "autre"]),
    sel("statut", ["nouvelle", "en_cours", "attente_tiers", "resolue", "close"], { required: true }),
    sel("priorite", ["basse", "normale", "haute", "urgente"]),
    date("echeance"),
  ]],
  ["reunion", (c) => [
    rel("copropriete", c.copropriete, { required: true }),
    sel("type", ["conseil_syndical", "ag_ordinaire", "ag_extraordinaire"], { required: true }),
    date("date", { required: true }),
    text("lieu"),
    editor("ordre_du_jour"),
    json("presents"),
    editor("pv"),
  ]],
  ["resolution", (c) => [
    rel("reunion", c.reunion, { required: true, cascadeDelete: true }),
    num("numero", { onlyInt: true }),
    text("intitule", { required: true, presentable: true }),
    sel("majorite", ["art_24", "art_25", "art_25_1", "art_26", "unanimite"]),
    sel("resultat", ["adoptee", "rejetee", "ajournee"]),
    json("votes"),
  ]],
  ["chantier", (c) => [
    rel("copropriete", c.copropriete, { required: true }),
    rel("demande", c.demande),
    rel("resolution", c.resolution),
    text("objet", { required: true, presentable: true }),
    sel("statut", ["besoin", "devis", "vote", "commande", "en_cours", "receptionne", "abandonne"], { required: true }),
    num("budget_vote_ttc"),
    date("date_debut"),
    date("date_fin"),
  ]],
  ["devis", (c) => [
    rel("copropriete", c.copropriete, { required: true }),
    rel("chantier", c.chantier),
    rel("demande", c.demande),
    rel("entreprise", c.entreprise, { required: true }),
    num("montant_ht"),
    num("montant_ttc"),
    date("date"),
    date("validite"),
    sel("statut", ["demande", "recu", "retenu", "refuse"], { required: true }),
    file("fichier", { maxSelect: 1 }),
  ]],
  ["courrier", (c) => [
    rel("copropriete", c.copropriete, { required: true }),
    sel("type", ["relance", "mise_en_demeure", "convocation", "demande_devis", "reponse_coproprietaire", "information", "autre"], { required: true }),
    text("destinataire", { required: true, presentable: true }),
    text("objet"),
    editor("corps"),
    sel("statut", ["brouillon", "valide", "envoye"], { required: true }),
    text("source_type"),
    text("source_id"),
    file("fichier", { maxSelect: 1 }),
  ]],
  ["visite", (c) => [
    rel("copropriete", c.copropriete, { required: true }),
    date("date", { required: true }),
    json("checklist"),
    editor("notes"),
    editor("transcription"),
    editor("rapport"),
    file("audio", { maxSelect: 10 }),
  ]],
  ["photo", (c) => [
    rel("copropriete", c.copropriete, { required: true }),
    rel("visite", c.visite, { cascadeDelete: true }),
    rel("demande", c.demande),
    file("fichier", { required: true, maxSelect: 1, mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"], thumbs: ["320x240"] }),
    text("legende", { presentable: true }),
    date("prise_le"),
  ]],
  ["document", (c) => [
    rel("copropriete", c.copropriete, { required: true }),
    file("fichier", { required: true, maxSelect: 1, maxSize: 200 * 1024 * 1024 }),
    text("titre", { presentable: true }),
    sel("type", ["reglement_copropriete", "pv_ag", "contrat", "devis", "facture", "sinistre", "courrier", "plan", "diagnostic", "autre"]),
    date("date"),
    sel("ingestion", ["en_attente", "ocr", "classification", "extraction", "indexation", "termine", "erreur"]),
    text("ingestion_erreur"),
    num("nb_pages", { onlyInt: true }),
    text("source_type"),
    text("source_id"),
  ]],
  ["extraction", (c) => [
    rel("document", c.document, { required: true, cascadeDelete: true }),
    text("champ", { required: true, presentable: true }),
    text("valeur"),
    num("confiance"),
    num("page", { onlyInt: true }),
    bool("verifie"),
  ]],
  ["tache", (c) => [
    rel("copropriete", c.copropriete),
    text("titre", { required: true, presentable: true }),
    date("echeance"),
    sel("statut", ["a_faire", "en_cours", "faite", "annulee"], { required: true }),
    sel("origine", ["manuelle", "ia", "systeme"]),
    text("objet_type"),
    text("objet_id"),
  ]],
  ["journal", (c) => [
    rel("copropriete", c.copropriete),
    text("action", { required: true }),
    text("objet_type"),
    text("objet_id"),
    json("details"),
    rel("auteur", "_pb_users_auth_"),
  ]],
];

migrate((app) => {
  const ids = {};
  for (const [name, fields] of COLLECTIONS) {
    const collection = new Collection({
      type: "base",
      name,
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: name === "journal" ? null : AUTH,
      fields: [
        ...fields(ids),
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: indexesFor(name),
    });
    app.save(collection);
    ids[name] = collection.id;
  }
}, (app) => {
  for (const [name] of [...COLLECTIONS].reverse()) {
    const collection = app.findCollectionByNameOrId(name);
    app.delete(collection);
  }
});

// Index sur `updated` pour la synchronisation incrémentale (pull des changements).
function indexesFor(name) {
  return [`CREATE INDEX idx_${name}_updated ON ${name} (updated)`];
}

// --- helpers de champs ---------------------------------------------------
function text(name, o = {}) { return { name, type: "text", ...o }; }
function editor(name, o = {}) { return { name, type: "editor", ...o }; }
function email(name, o = {}) { return { name, type: "email", ...o }; }
function num(name, o = {}) { return { name, type: "number", ...o }; }
function bool(name, o = {}) { return { name, type: "bool", ...o }; }
function date(name, o = {}) { return { name, type: "date", ...o }; }
function json(name, o = {}) { return { name, type: "json", maxSize: 0, ...o }; }
function sel(name, values, o = {}) { return { name, type: "select", values, maxSelect: 1, ...o }; }
function file(name, o = {}) { return { name, type: "file", maxSelect: 1, maxSize: 20 * 1024 * 1024, ...o }; }
function rel(name, collectionId, o = {}) {
  if (!collectionId) throw new Error(`relation ${name}: collection cible inconnue`);
  return { name, type: "relation", collectionId, maxSelect: 1, cascadeDelete: false, ...o };
}
