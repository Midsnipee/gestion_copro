-- Schéma initial. Doit correspondre à shared/src/tables.ts (vérifié par api/test/schema.test.ts).
-- Chaque table synchronisée : id uuid (généré par l'appareil), version (contrôle des conflits),
-- created / updated (gérés par le serveur).

CREATE TABLE utilisateur (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  nom text NOT NULL,
  mot_de_passe text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE jeton_renouvellement (
  hash text PRIMARY KEY,
  utilisateur_id uuid NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  expire timestamptz NOT NULL,
  created timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE copropriete (
  id uuid PRIMARY KEY,
  nom text NOT NULL,
  alias jsonb NOT NULL DEFAULT '[]',
  adresse text NOT NULL DEFAULT '',
  code_postal text,
  ville text,
  nb_lots integer,
  syndic_depuis date,
  notes text
);

CREATE TABLE lot (
  id uuid PRIMARY KEY,
  copropriete_id uuid NOT NULL REFERENCES copropriete(id) ON DELETE CASCADE,
  numero text NOT NULL,
  type text,
  tantiemes integer,
  etage text
);

CREATE TABLE personne (
  id uuid PRIMARY KEY,
  copropriete_id uuid NOT NULL REFERENCES copropriete(id) ON DELETE CASCADE,
  lot_id uuid REFERENCES lot(id) ON DELETE SET NULL,
  nom text NOT NULL,
  prenom text,
  role text,
  email text,
  telephone text,
  adresse_postale text,
  notes text
);

CREATE TABLE entreprise (
  id uuid PRIMARY KEY,
  raison_sociale text NOT NULL,
  corps_metier jsonb NOT NULL DEFAULT '[]',
  contact text,
  email text,
  telephone text,
  siret text,
  assurance_fin date,
  notes text
);

CREATE TABLE contrat (
  id uuid PRIMARY KEY,
  copropriete_id uuid NOT NULL REFERENCES copropriete(id) ON DELETE CASCADE,
  entreprise_id uuid REFERENCES entreprise(id) ON DELETE SET NULL,
  objet text NOT NULL,
  date_debut date,
  date_fin date,
  preavis_mois integer,
  montant_annuel_ttc numeric(12,2)
);

CREATE TABLE demande (
  id uuid PRIMARY KEY,
  copropriete_id uuid NOT NULL REFERENCES copropriete(id) ON DELETE CASCADE,
  demandeur_id uuid REFERENCES personne(id) ON DELETE SET NULL,
  titre text NOT NULL,
  description text,
  categorie text,
  statut text NOT NULL DEFAULT 'nouvelle'
    CHECK (statut IN ('nouvelle', 'en_cours', 'attente_tiers', 'resolue', 'close')),
  priorite text,
  echeance date
);

CREATE TABLE reunion (
  id uuid PRIMARY KEY,
  copropriete_id uuid NOT NULL REFERENCES copropriete(id) ON DELETE CASCADE,
  type text NOT NULL,
  date timestamptz,
  lieu text,
  ordre_du_jour text,
  presents jsonb NOT NULL DEFAULT '[]',
  pv text
);

CREATE TABLE resolution (
  id uuid PRIMARY KEY,
  reunion_id uuid NOT NULL REFERENCES reunion(id) ON DELETE CASCADE,
  numero integer,
  intitule text NOT NULL,
  majorite text,
  resultat text,
  votes jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE chantier (
  id uuid PRIMARY KEY,
  copropriete_id uuid NOT NULL REFERENCES copropriete(id) ON DELETE CASCADE,
  demande_id uuid REFERENCES demande(id) ON DELETE SET NULL,
  resolution_id uuid REFERENCES resolution(id) ON DELETE SET NULL,
  objet text NOT NULL,
  statut text NOT NULL DEFAULT 'besoin',
  budget_vote_ttc numeric(12,2),
  date_debut date,
  date_fin date
);

CREATE TABLE devis (
  id uuid PRIMARY KEY,
  copropriete_id uuid NOT NULL REFERENCES copropriete(id) ON DELETE CASCADE,
  chantier_id uuid REFERENCES chantier(id) ON DELETE SET NULL,
  demande_id uuid REFERENCES demande(id) ON DELETE SET NULL,
  entreprise_id uuid REFERENCES entreprise(id) ON DELETE SET NULL,
  montant_ht numeric(12,2),
  montant_ttc numeric(12,2),
  date date,
  validite date,
  statut text NOT NULL DEFAULT 'demande',
  fichier text
);

CREATE TABLE courrier (
  id uuid PRIMARY KEY,
  copropriete_id uuid NOT NULL REFERENCES copropriete(id) ON DELETE CASCADE,
  type text NOT NULL,
  destinataire text NOT NULL DEFAULT '',
  objet text,
  corps text,
  statut text NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'valide', 'envoye')),
  source_type text,
  source_id uuid,
  fichier text
);

CREATE TABLE visite (
  id uuid PRIMARY KEY,
  copropriete_id uuid NOT NULL REFERENCES copropriete(id) ON DELETE CASCADE,
  date timestamptz,
  checklist jsonb NOT NULL DEFAULT '[]',
  notes text,
  transcription text,
  rapport text
);

CREATE TABLE photo (
  id uuid PRIMARY KEY,
  copropriete_id uuid NOT NULL REFERENCES copropriete(id) ON DELETE CASCADE,
  visite_id uuid REFERENCES visite(id) ON DELETE CASCADE,
  demande_id uuid REFERENCES demande(id) ON DELETE SET NULL,
  fichier text,
  legende text,
  prise_le timestamptz
);

CREATE TABLE document (
  id uuid PRIMARY KEY,
  copropriete_id uuid NOT NULL REFERENCES copropriete(id) ON DELETE CASCADE,
  fichier text,
  titre text,
  type text,
  date date,
  ingestion text NOT NULL DEFAULT 'en_attente',
  ingestion_erreur text,
  nb_pages integer,
  source_type text,
  source_id uuid
);

CREATE TABLE extraction (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  champ text NOT NULL,
  valeur text,
  confiance real,
  page integer,
  verifie boolean NOT NULL DEFAULT false
);

CREATE TABLE tache (
  id uuid PRIMARY KEY,
  copropriete_id uuid REFERENCES copropriete(id) ON DELETE CASCADE,
  titre text NOT NULL,
  echeance date,
  statut text NOT NULL DEFAULT 'a_faire',
  origine text,
  objet_type text,
  objet_id uuid
);

CREATE TABLE journal (
  id uuid PRIMARY KEY,
  copropriete_id uuid REFERENCES copropriete(id) ON DELETE SET NULL,
  action text NOT NULL,
  objet_type text,
  objet_id uuid,
  details jsonb,
  auteur_id uuid
);

CREATE TABLE conflit (
  id uuid PRIMARY KEY,
  nature text NOT NULL CHECK (nature IN ('concurrence', 'rejet')),
  table_cible text NOT NULL,
  ligne_id uuid NOT NULL,
  operation text NOT NULL,
  donnees_appareil jsonb,
  donnees_serveur jsonb,
  message text,
  auteur_id uuid
);

-- Colonnes communes, index de synchronisation, mise à jour de `updated`
CREATE FUNCTION maj_updated() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated := now();
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['copropriete','lot','personne','entreprise','contrat','demande','reunion',
    'resolution','chantier','devis','courrier','visite','photo','document','extraction','tache','journal','conflit']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN version integer NOT NULL DEFAULT 1,
                    ADD COLUMN created timestamptz NOT NULL DEFAULT now(),
                    ADD COLUMN updated timestamptz NOT NULL DEFAULT now()', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION maj_updated()', t || '_updated', t);
  END LOOP;
END $$;

CREATE INDEX ON lot (copropriete_id);
CREATE INDEX ON personne (copropriete_id);
CREATE INDEX ON contrat (copropriete_id);
CREATE INDEX ON contrat (date_fin);
CREATE INDEX ON demande (copropriete_id, statut);
CREATE INDEX ON reunion (copropriete_id);
CREATE INDEX ON resolution (reunion_id);
CREATE INDEX ON chantier (copropriete_id);
CREATE INDEX ON devis (copropriete_id);
CREATE INDEX ON courrier (copropriete_id);
CREATE INDEX ON visite (copropriete_id);
CREATE INDEX ON photo (copropriete_id);
CREATE INDEX ON document (copropriete_id);
CREATE INDEX ON extraction (document_id);
CREATE INDEX ON tache (copropriete_id, statut);

-- Publication lue par PowerSync (réplication logique)
CREATE PUBLICATION powersync FOR TABLE
  copropriete, lot, personne, entreprise, contrat, demande, reunion, resolution, chantier,
  devis, courrier, visite, photo, document, extraction, tache, journal, conflit;
