-- Administration : rôles, dernière connexion, paramètres, journal des actions d'administration.

ALTER TABLE utilisateur
  ADD COLUMN role text NOT NULL DEFAULT 'gestionnaire' CHECK (role IN ('admin', 'gestionnaire')),
  ADD COLUMN derniere_connexion timestamptz;

-- Le plus ancien compte existant devient administrateur
UPDATE utilisateur SET role = 'admin'
WHERE id = (SELECT id FROM utilisateur ORDER BY created LIMIT 1);

ALTER TABLE jeton_renouvellement ADD COLUMN appareil text;

CREATE TABLE parametre (
  cle text PRIMARY KEY,
  valeur jsonb NOT NULL,
  updated timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE journal_admin (
  id bigserial PRIMARY KEY,
  auteur_id uuid REFERENCES utilisateur(id) ON DELETE SET NULL,
  action text NOT NULL,
  cible text,
  details jsonb,
  created timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON journal_admin (created DESC);
