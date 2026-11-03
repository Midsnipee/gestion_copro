/**
 * Source unique des tables synchronisées : utilisée par l'API (liste blanche des
 * colonnes, conversion des types) et par le front (schéma PowerSync local).
 * Le SQL de api/migrations doit correspondre : un test le vérifie.
 *
 * Colonnes implicites sur chaque table : id (uuid), version, created, updated.
 */

export type TypeColonne = 'text' | 'integer' | 'real' | 'bool' | 'date' | 'timestamp' | 'json' | 'uuid';

export const TABLES = {
	copropriete: {
		nom: 'text',
		alias: 'json',
		adresse: 'text',
		code_postal: 'text',
		ville: 'text',
		nb_lots: 'integer',
		syndic_depuis: 'date',
		notes: 'text'
	},
	lot: {
		copropriete_id: 'uuid',
		numero: 'text',
		type: 'text',
		tantiemes: 'integer',
		etage: 'text'
	},
	personne: {
		copropriete_id: 'uuid',
		lot_id: 'uuid',
		nom: 'text',
		prenom: 'text',
		role: 'text',
		email: 'text',
		telephone: 'text',
		adresse_postale: 'text',
		notes: 'text'
	},
	entreprise: {
		raison_sociale: 'text',
		corps_metier: 'json',
		contact: 'text',
		email: 'text',
		telephone: 'text',
		siret: 'text',
		assurance_fin: 'date',
		notes: 'text'
	},
	contrat: {
		copropriete_id: 'uuid',
		entreprise_id: 'uuid',
		objet: 'text',
		date_debut: 'date',
		date_fin: 'date',
		preavis_mois: 'integer',
		montant_annuel_ttc: 'real'
	},
	demande: {
		copropriete_id: 'uuid',
		demandeur_id: 'uuid',
		titre: 'text',
		description: 'text',
		categorie: 'text',
		statut: 'text',
		priorite: 'text',
		echeance: 'date'
	},
	reunion: {
		copropriete_id: 'uuid',
		type: 'text',
		date: 'timestamp',
		lieu: 'text',
		ordre_du_jour: 'text',
		presents: 'json',
		pv: 'text'
	},
	resolution: {
		reunion_id: 'uuid',
		numero: 'integer',
		intitule: 'text',
		majorite: 'text',
		resultat: 'text',
		votes: 'json'
	},
	chantier: {
		copropriete_id: 'uuid',
		demande_id: 'uuid',
		resolution_id: 'uuid',
		objet: 'text',
		statut: 'text',
		budget_vote_ttc: 'real',
		date_debut: 'date',
		date_fin: 'date'
	},
	devis: {
		copropriete_id: 'uuid',
		chantier_id: 'uuid',
		demande_id: 'uuid',
		entreprise_id: 'uuid',
		montant_ht: 'real',
		montant_ttc: 'real',
		date: 'date',
		validite: 'date',
		statut: 'text',
		fichier: 'text'
	},
	courrier: {
		copropriete_id: 'uuid',
		type: 'text',
		destinataire: 'text',
		objet: 'text',
		corps: 'text',
		statut: 'text',
		source_type: 'text',
		source_id: 'uuid',
		fichier: 'text'
	},
	visite: {
		copropriete_id: 'uuid',
		date: 'timestamp',
		checklist: 'json',
		notes: 'text',
		transcription: 'text',
		rapport: 'text'
	},
	photo: {
		copropriete_id: 'uuid',
		visite_id: 'uuid',
		demande_id: 'uuid',
		fichier: 'text',
		legende: 'text',
		prise_le: 'timestamp'
	},
	document: {
		copropriete_id: 'uuid',
		fichier: 'text',
		titre: 'text',
		type: 'text',
		date: 'date',
		ingestion: 'text',
		ingestion_erreur: 'text',
		nb_pages: 'integer',
		source_type: 'text',
		source_id: 'uuid'
	},
	extraction: {
		document_id: 'uuid',
		champ: 'text',
		valeur: 'text',
		confiance: 'real',
		page: 'integer',
		verifie: 'bool'
	},
	tache: {
		copropriete_id: 'uuid',
		titre: 'text',
		echeance: 'date',
		statut: 'text',
		origine: 'text',
		objet_type: 'text',
		objet_id: 'uuid'
	},
	journal: {
		copropriete_id: 'uuid',
		action: 'text',
		objet_type: 'text',
		objet_id: 'uuid',
		details: 'json',
		auteur_id: 'uuid'
	},
	// Écritures refusées par le serveur (modification concurrente ou donnée invalide),
	// affichées à l'utilisatrice pour qu'elle tranche.
	conflit: {
		nature: 'text', // 'concurrence' | 'rejet'
		table_cible: 'text',
		ligne_id: 'uuid',
		operation: 'text',
		donnees_appareil: 'json',
		donnees_serveur: 'json',
		message: 'text',
		auteur_id: 'uuid'
	}
} as const satisfies Record<string, Record<string, TypeColonne>>;

export type NomTable = keyof typeof TABLES;
export const NOMS_TABLES = Object.keys(TABLES) as NomTable[];

/** Colonnes gérées par le serveur, jamais acceptées telles quelles depuis un appareil. */
export const COLONNES_SERVEUR = ['version', 'created', 'updated'] as const;

export const estTable = (t: string): t is NomTable => Object.hasOwn(TABLES, t);
