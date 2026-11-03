/**
 * Description de chaque module de l'application : ce que la liste affiche,
 * ce que le formulaire édite, les filtres proposés. Les écrans génériques
 * (ListeModule, FormulaireModule) se construisent à partir de ces définitions.
 */
import type { NomTable } from '@copro/shared/tables';
import { CATEGORIES_DEMANDE, PRIORITES, STATUTS_DEMANDE, TYPES_COURRIER } from '../lib/libelles';

export type Options = Record<string, string>;

export type Champ =
	| { nom: string; libelle: string; type: 'text' | 'email' | 'tel' | 'textarea'; requis?: boolean; aide?: string; large?: boolean }
	| { nom: string; libelle: string; type: 'number'; requis?: boolean; entier?: boolean; unite?: string }
	| { nom: string; libelle: string; type: 'date' | 'datetime'; requis?: boolean }
	| { nom: string; libelle: string; type: 'bool' }
	| { nom: string; libelle: string; type: 'select'; options: Options; requis?: boolean; defaut?: string }
	| { nom: string; libelle: string; type: 'tags'; aide?: string }
	| { nom: string; libelle: string; type: 'ref'; table: NomTable; affichage: string; requis?: boolean; memeCopro?: boolean };

export type Format = 'texte' | 'date' | 'datetime' | 'euros' | 'nombre' | 'statut' | 'ref' | 'tags';

export interface Colonne {
	champ: string;
	libelle: string;
	format?: Format;
	/** Colonne masquée sur petit écran */
	secondaire?: boolean;
}

export interface Module {
	cle: string;
	table: NomTable;
	titre: string;
	unite: string; // « une demande »
	champs: Champ[];
	colonnes: Colonne[];
	/** Colonne affichée comme titre de la ligne */
	titreLigne: string;
	recherche: string[];
	tri: string;
	/** Filtres proposés au-dessus de la liste (champs select) */
	filtres?: string[];
	/** Le module est rattaché à une copropriété (filtre et colonne copro) */
	parCopro: boolean;
	/** Valeurs « terminées » (grisées et masquées par défaut) */
	termine?: { champ: string; valeurs: string[] };
}

// --- Listes de valeurs ------------------------------------------------------

export const TYPES_LOT: Options = { appartement: 'Appartement', commerce: 'Commerce', parking: 'Parking', cave: 'Cave', bureau: 'Bureau', autre: 'Autre' };
export const ROLES_PERSONNE: Options = {
	coproprietaire: 'Copropriétaire',
	locataire: 'Locataire',
	conseil_syndical: 'Conseil syndical',
	president_cs: 'Président du CS',
	gardien: 'Gardien',
	autre: 'Autre'
};
export const STATUTS_CHANTIER: Options = {
	besoin: 'Besoin identifié',
	devis: 'Devis en cours',
	vote: 'À voter',
	commande: 'Commandé',
	en_cours: 'En cours',
	receptionne: 'Réceptionné',
	abandonne: 'Abandonné'
};
export const STATUTS_DEVIS: Options = { demande: 'Demandé', recu: 'Reçu', retenu: 'Retenu', refuse: 'Refusé' };
export const STATUTS_COURRIER: Options = { brouillon: 'Brouillon', valide: 'Validé', envoye: 'Envoyé' };
export const TYPES_REUNION: Options = { conseil_syndical: 'Conseil syndical', ag_ordinaire: 'AG ordinaire', ag_extraordinaire: 'AG extraordinaire' };
export const MAJORITES: Options = { art_24: 'Article 24', art_25: 'Article 25', art_25_1: 'Article 25-1', art_26: 'Article 26', unanimite: 'Unanimité' };
export const RESULTATS: Options = { adoptee: 'Adoptée', rejetee: 'Rejetée', ajournee: 'Ajournée' };
export const TYPES_DOCUMENT: Options = {
	reglement_copropriete: 'Règlement de copropriété',
	pv_ag: "PV d'AG",
	contrat: 'Contrat',
	devis: 'Devis',
	facture: 'Facture',
	sinistre: 'Sinistre',
	courrier: 'Courrier',
	plan: 'Plan',
	diagnostic: 'Diagnostic',
	autre: 'Autre'
};
export const STATUTS_TACHE: Options = { a_faire: 'À faire', en_cours: 'En cours', faite: 'Faite', annulee: 'Annulée' };

const copro: Champ = { nom: 'copropriete_id', libelle: 'Copropriété', type: 'ref', table: 'copropriete', affichage: 'nom', requis: true };
const colCopro: Colonne = { champ: 'copropriete_id', libelle: 'Copropriété', format: 'ref' };

// --- Modules ----------------------------------------------------------------

export const MODULES: Module[] = [
	{
		cle: 'coproprietes',
		table: 'copropriete',
		titre: 'Copropriétés',
		unite: 'une copropriété',
		parCopro: false,
		titreLigne: 'nom',
		recherche: ['nom', 'adresse', 'ville', 'alias'],
		tri: 'nom COLLATE NOCASE',
		champs: [
			{ nom: 'nom', libelle: 'Nom', type: 'text', requis: true },
			{ nom: 'alias', libelle: 'Autres noms', type: 'tags', aide: 'Séparés par des virgules : « Les Tilleuls, 12 rue des Lilas »' },
			{ nom: 'adresse', libelle: 'Adresse', type: 'text', requis: true },
			{ nom: 'code_postal', libelle: 'Code postal', type: 'text' },
			{ nom: 'ville', libelle: 'Ville', type: 'text' },
			{ nom: 'nb_lots', libelle: 'Nombre de lots', type: 'number', entier: true },
			{ nom: 'syndic_depuis', libelle: 'Syndic depuis le', type: 'date' },
			{ nom: 'notes', libelle: 'Notes', type: 'textarea', large: true }
		],
		colonnes: [
			{ champ: 'adresse', libelle: 'Adresse' },
			{ champ: 'ville', libelle: 'Ville' },
			{ champ: 'nb_lots', libelle: 'Lots', format: 'nombre', secondaire: true }
		]
	},
	{
		cle: 'demandes',
		table: 'demande',
		titre: 'Demandes',
		unite: 'une demande',
		parCopro: true,
		titreLigne: 'titre',
		recherche: ['titre', 'description'],
		tri: "CASE priorite WHEN 'urgente' THEN 0 WHEN 'haute' THEN 1 WHEN 'normale' THEN 2 ELSE 3 END, created DESC",
		filtres: ['statut', 'priorite', 'categorie'],
		termine: { champ: 'statut', valeurs: ['resolue', 'close'] },
		champs: [
			copro,
			{ nom: 'titre', libelle: 'Titre', type: 'text', requis: true, large: true },
			{ nom: 'categorie', libelle: 'Catégorie', type: 'select', options: CATEGORIES_DEMANDE, defaut: 'autre' },
			{ nom: 'priorite', libelle: 'Priorité', type: 'select', options: PRIORITES, defaut: 'normale' },
			{ nom: 'statut', libelle: 'Statut', type: 'select', options: STATUTS_DEMANDE, requis: true, defaut: 'nouvelle' },
			{ nom: 'echeance', libelle: 'Échéance', type: 'date' },
			{ nom: 'demandeur_id', libelle: 'Demandeur', type: 'ref', table: 'personne', affichage: "nom || coalesce(' ' || prenom, '')", memeCopro: true },
			{ nom: 'description', libelle: 'Description', type: 'textarea', large: true }
		],
		colonnes: [
			colCopro,
			{ champ: 'categorie', libelle: 'Catégorie', secondaire: true },
			{ champ: 'priorite', libelle: 'Priorité', format: 'statut' },
			{ champ: 'statut', libelle: 'Statut', format: 'statut' },
			{ champ: 'echeance', libelle: 'Échéance', format: 'date', secondaire: true }
		]
	},
	{
		cle: 'taches',
		table: 'tache',
		titre: 'Tâches',
		unite: 'une tâche',
		parCopro: true,
		titreLigne: 'titre',
		recherche: ['titre'],
		tri: 'echeance IS NULL, echeance',
		filtres: ['statut'],
		termine: { champ: 'statut', valeurs: ['faite', 'annulee'] },
		champs: [
			{ ...copro, requis: false } as Champ,
			{ nom: 'titre', libelle: 'Titre', type: 'text', requis: true, large: true },
			{ nom: 'echeance', libelle: 'Échéance', type: 'date' },
			{ nom: 'statut', libelle: 'Statut', type: 'select', options: STATUTS_TACHE, requis: true, defaut: 'a_faire' }
		],
		colonnes: [colCopro, { champ: 'echeance', libelle: 'Échéance', format: 'date' }, { champ: 'statut', libelle: 'Statut', format: 'statut' }]
	},
	{
		cle: 'travaux',
		table: 'chantier',
		titre: 'Travaux',
		unite: 'un chantier',
		parCopro: true,
		titreLigne: 'objet',
		recherche: ['objet'],
		tri: 'created DESC',
		filtres: ['statut'],
		termine: { champ: 'statut', valeurs: ['receptionne', 'abandonne'] },
		champs: [
			copro,
			{ nom: 'objet', libelle: 'Objet', type: 'text', requis: true, large: true },
			{ nom: 'statut', libelle: 'Étape', type: 'select', options: STATUTS_CHANTIER, requis: true, defaut: 'besoin' },
			{ nom: 'budget_vote_ttc', libelle: 'Budget voté TTC', type: 'number', unite: '€' },
			{ nom: 'date_debut', libelle: 'Début', type: 'date' },
			{ nom: 'date_fin', libelle: 'Fin', type: 'date' },
			{ nom: 'demande_id', libelle: 'Demande liée', type: 'ref', table: 'demande', affichage: 'titre', memeCopro: true },
			{ nom: 'resolution_id', libelle: 'Résolution votée', type: 'ref', table: 'resolution', affichage: 'intitule' }
		],
		colonnes: [colCopro, { champ: 'statut', libelle: 'Étape', format: 'statut' }, { champ: 'budget_vote_ttc', libelle: 'Budget', format: 'euros', secondaire: true }]
	},
	{
		cle: 'devis',
		table: 'devis',
		titre: 'Devis',
		unite: 'un devis',
		parCopro: true,
		titreLigne: 'entreprise_id',
		recherche: [],
		tri: 'created DESC',
		filtres: ['statut'],
		termine: { champ: 'statut', valeurs: ['refuse'] },
		champs: [
			copro,
			{ nom: 'entreprise_id', libelle: 'Entreprise', type: 'ref', table: 'entreprise', affichage: 'raison_sociale', requis: true },
			{ nom: 'chantier_id', libelle: 'Chantier', type: 'ref', table: 'chantier', affichage: 'objet', memeCopro: true },
			{ nom: 'demande_id', libelle: 'Demande', type: 'ref', table: 'demande', affichage: 'titre', memeCopro: true },
			{ nom: 'statut', libelle: 'Statut', type: 'select', options: STATUTS_DEVIS, requis: true, defaut: 'demande' },
			{ nom: 'montant_ht', libelle: 'Montant HT', type: 'number', unite: '€' },
			{ nom: 'montant_ttc', libelle: 'Montant TTC', type: 'number', unite: '€' },
			{ nom: 'date', libelle: 'Date du devis', type: 'date' },
			{ nom: 'validite', libelle: "Valable jusqu'au", type: 'date' }
		],
		colonnes: [
			colCopro,
			{ champ: 'chantier_id', libelle: 'Chantier', format: 'ref', secondaire: true },
			{ champ: 'montant_ttc', libelle: 'TTC', format: 'euros' },
			{ champ: 'statut', libelle: 'Statut', format: 'statut' }
		]
	},
	{
		cle: 'courriers',
		table: 'courrier',
		titre: 'Courriers',
		unite: 'un courrier',
		parCopro: true,
		titreLigne: 'objet',
		recherche: ['objet', 'destinataire', 'corps'],
		tri: 'updated DESC',
		filtres: ['statut', 'type'],
		champs: [
			copro,
			{ nom: 'type', libelle: 'Type', type: 'select', options: TYPES_COURRIER, requis: true, defaut: 'information' },
			{ nom: 'destinataire', libelle: 'Destinataire', type: 'text', requis: true },
			{ nom: 'objet', libelle: 'Objet', type: 'text', large: true },
			{ nom: 'statut', libelle: 'Statut', type: 'select', options: STATUTS_COURRIER, requis: true, defaut: 'brouillon' },
			{ nom: 'corps', libelle: 'Texte', type: 'textarea', large: true }
		],
		colonnes: [colCopro, { champ: 'destinataire', libelle: 'Destinataire', secondaire: true }, { champ: 'statut', libelle: 'Statut', format: 'statut' }, { champ: 'updated', libelle: 'Modifié', format: 'date', secondaire: true }]
	},
	{
		cle: 'visites',
		table: 'visite',
		titre: 'Visites',
		unite: 'une visite',
		parCopro: true,
		titreLigne: 'date',
		recherche: ['notes', 'rapport'],
		tri: 'date DESC',
		champs: [
			copro,
			{ nom: 'date', libelle: 'Date', type: 'datetime', requis: true },
			{ nom: 'notes', libelle: 'Constats', type: 'textarea', large: true, aide: 'Saisie possible hors ligne, sur place.' },
			{ nom: 'rapport', libelle: 'Rapport', type: 'textarea', large: true }
		],
		colonnes: [colCopro, { champ: 'notes', libelle: 'Constats', secondaire: true }]
	},
	{
		cle: 'reunions',
		table: 'reunion',
		titre: 'Réunions et AG',
		unite: 'une réunion',
		parCopro: true,
		titreLigne: 'type',
		recherche: ['lieu', 'ordre_du_jour', 'pv'],
		tri: 'date DESC',
		filtres: ['type'],
		champs: [
			copro,
			{ nom: 'type', libelle: 'Type', type: 'select', options: TYPES_REUNION, requis: true, defaut: 'conseil_syndical' },
			{ nom: 'date', libelle: 'Date', type: 'datetime', requis: true },
			{ nom: 'lieu', libelle: 'Lieu', type: 'text' },
			{ nom: 'ordre_du_jour', libelle: 'Ordre du jour', type: 'textarea', large: true },
			{ nom: 'pv', libelle: 'Procès-verbal', type: 'textarea', large: true }
		],
		colonnes: [colCopro, { champ: 'date', libelle: 'Date', format: 'datetime' }, { champ: 'lieu', libelle: 'Lieu', secondaire: true }]
	},
	{
		cle: 'resolutions',
		table: 'resolution',
		titre: 'Résolutions',
		unite: 'une résolution',
		parCopro: false,
		titreLigne: 'intitule',
		recherche: ['intitule'],
		tri: 'numero',
		filtres: ['resultat'],
		champs: [
			{ nom: 'reunion_id', libelle: 'Réunion', type: 'ref', table: 'reunion', affichage: "strftime('%d/%m/%Y', date) || ' · ' || type", requis: true },
			{ nom: 'numero', libelle: 'N°', type: 'number', entier: true },
			{ nom: 'intitule', libelle: 'Intitulé', type: 'text', requis: true, large: true },
			{ nom: 'majorite', libelle: 'Majorité', type: 'select', options: MAJORITES },
			{ nom: 'resultat', libelle: 'Résultat', type: 'select', options: RESULTATS }
		],
		colonnes: [
			{ champ: 'reunion_id', libelle: 'Réunion', format: 'ref' },
			{ champ: 'majorite', libelle: 'Majorité', format: 'statut', secondaire: true },
			{ champ: 'resultat', libelle: 'Résultat', format: 'statut' }
		]
	},
	{
		cle: 'lots',
		table: 'lot',
		titre: 'Lots',
		unite: 'un lot',
		parCopro: true,
		titreLigne: 'numero',
		recherche: ['numero', 'etage'],
		tri: 'numero COLLATE NOCASE',
		filtres: ['type'],
		champs: [
			copro,
			{ nom: 'numero', libelle: 'Numéro', type: 'text', requis: true },
			{ nom: 'type', libelle: 'Type', type: 'select', options: TYPES_LOT, defaut: 'appartement' },
			{ nom: 'etage', libelle: 'Étage', type: 'text' },
			{ nom: 'tantiemes', libelle: 'Tantièmes', type: 'number', entier: true }
		],
		colonnes: [colCopro, { champ: 'type', libelle: 'Type', format: 'statut' }, { champ: 'etage', libelle: 'Étage', secondaire: true }, { champ: 'tantiemes', libelle: 'Tantièmes', format: 'nombre' }]
	},
	{
		cle: 'personnes',
		table: 'personne',
		titre: 'Personnes',
		unite: 'une personne',
		parCopro: true,
		titreLigne: 'nom',
		recherche: ['nom', 'prenom', 'email', 'telephone'],
		tri: 'nom COLLATE NOCASE',
		filtres: ['role'],
		champs: [
			copro,
			{ nom: 'nom', libelle: 'Nom', type: 'text', requis: true },
			{ nom: 'prenom', libelle: 'Prénom', type: 'text' },
			{ nom: 'role', libelle: 'Rôle', type: 'select', options: ROLES_PERSONNE, defaut: 'coproprietaire' },
			{ nom: 'lot_id', libelle: 'Lot', type: 'ref', table: 'lot', affichage: "numero || coalesce(' · ' || etage, '')", memeCopro: true },
			{ nom: 'email', libelle: 'E-mail', type: 'email' },
			{ nom: 'telephone', libelle: 'Téléphone', type: 'tel' },
			{ nom: 'adresse_postale', libelle: 'Adresse postale', type: 'text', large: true },
			{ nom: 'notes', libelle: 'Notes', type: 'textarea', large: true }
		],
		colonnes: [colCopro, { champ: 'prenom', libelle: 'Prénom' }, { champ: 'role', libelle: 'Rôle', format: 'statut' }, { champ: 'telephone', libelle: 'Téléphone', secondaire: true }]
	},
	{
		cle: 'entreprises',
		table: 'entreprise',
		titre: 'Entreprises',
		unite: 'une entreprise',
		parCopro: false,
		titreLigne: 'raison_sociale',
		recherche: ['raison_sociale', 'contact', 'corps_metier'],
		tri: 'raison_sociale COLLATE NOCASE',
		champs: [
			{ nom: 'raison_sociale', libelle: 'Raison sociale', type: 'text', requis: true },
			{ nom: 'corps_metier', libelle: 'Corps de métier', type: 'tags', aide: 'Séparés par des virgules : plomberie, chauffage' },
			{ nom: 'contact', libelle: 'Contact', type: 'text' },
			{ nom: 'email', libelle: 'E-mail', type: 'email' },
			{ nom: 'telephone', libelle: 'Téléphone', type: 'tel' },
			{ nom: 'siret', libelle: 'SIRET', type: 'text' },
			{ nom: 'assurance_fin', libelle: 'Assurance valable jusqu’au', type: 'date' },
			{ nom: 'notes', libelle: 'Notes', type: 'textarea', large: true }
		],
		colonnes: [
			{ champ: 'corps_metier', libelle: 'Métiers', format: 'tags' },
			{ champ: 'telephone', libelle: 'Téléphone', secondaire: true },
			{ champ: 'assurance_fin', libelle: 'Assurance', format: 'date', secondaire: true }
		]
	},
	{
		cle: 'contrats',
		table: 'contrat',
		titre: 'Contrats',
		unite: 'un contrat',
		parCopro: true,
		titreLigne: 'objet',
		recherche: ['objet'],
		tri: 'date_fin IS NULL, date_fin',
		champs: [
			copro,
			{ nom: 'objet', libelle: 'Objet', type: 'text', requis: true, large: true },
			{ nom: 'entreprise_id', libelle: 'Prestataire', type: 'ref', table: 'entreprise', affichage: 'raison_sociale' },
			{ nom: 'date_debut', libelle: 'Début', type: 'date' },
			{ nom: 'date_fin', libelle: 'Fin', type: 'date' },
			{ nom: 'preavis_mois', libelle: 'Préavis', type: 'number', entier: true, unite: 'mois' },
			{ nom: 'montant_annuel_ttc', libelle: 'Montant annuel TTC', type: 'number', unite: '€' }
		],
		colonnes: [colCopro, { champ: 'entreprise_id', libelle: 'Prestataire', format: 'ref' }, { champ: 'date_fin', libelle: 'Fin', format: 'date' }, { champ: 'montant_annuel_ttc', libelle: 'Annuel', format: 'euros', secondaire: true }]
	},
	{
		cle: 'documents',
		table: 'document',
		titre: 'Documents',
		unite: 'un document',
		parCopro: true,
		titreLigne: 'titre',
		recherche: ['titre'],
		tri: 'date DESC',
		filtres: ['type'],
		champs: [
			copro,
			{ nom: 'titre', libelle: 'Titre', type: 'text', requis: true, large: true },
			{ nom: 'type', libelle: 'Type', type: 'select', options: TYPES_DOCUMENT, defaut: 'autre' },
			{ nom: 'date', libelle: 'Date', type: 'date' }
		],
		colonnes: [colCopro, { champ: 'type', libelle: 'Type', format: 'statut' }, { champ: 'date', libelle: 'Date', format: 'date' }]
	}
];

export const module = (cle: string) => MODULES.find((m) => m.cle === cle);
export const moduleDeTable = (t: string) => MODULES.find((m) => m.table === t);

/** Libellés de toutes les listes de valeurs, pour l'affichage des statuts. */
export function libelleValeur(m: Module, champ: string, valeur: unknown): string {
	const c = m.champs.find((x) => x.nom === champ);
	if (c?.type === 'select') return c.options[String(valeur)] ?? String(valeur ?? '');
	return String(valeur ?? '');
}

/** Menu latéral : groupes de modules. */
export const MENU: { groupe: string; entrees: { cle: string; titre: string; chemin: string }[] }[] = [
	{ groupe: '', entrees: [{ cle: 'accueil', titre: 'Tableau de bord', chemin: '/' }] },
	{
		groupe: 'Suivi',
		entrees: [
			{ cle: 'demandes', titre: 'Demandes', chemin: '/m/demandes' },
			{ cle: 'taches', titre: 'Tâches', chemin: '/m/taches' },
			{ cle: 'travaux', titre: 'Travaux', chemin: '/m/travaux' },
			{ cle: 'devis', titre: 'Devis', chemin: '/m/devis' }
		]
	},
	{
		groupe: 'Rédaction et terrain',
		entrees: [
			{ cle: 'courriers', titre: 'Courriers', chemin: '/m/courriers' },
			{ cle: 'visites', titre: 'Visites', chemin: '/m/visites' },
			{ cle: 'reunions', titre: 'Réunions et AG', chemin: '/m/reunions' },
			{ cle: 'resolutions', titre: 'Résolutions', chemin: '/m/resolutions' }
		]
	},
	{
		groupe: 'Patrimoine et annuaire',
		entrees: [
			{ cle: 'coproprietes', titre: 'Copropriétés', chemin: '/m/coproprietes' },
			{ cle: 'lots', titre: 'Lots', chemin: '/m/lots' },
			{ cle: 'personnes', titre: 'Personnes', chemin: '/m/personnes' },
			{ cle: 'entreprises', titre: 'Entreprises', chemin: '/m/entreprises' },
			{ cle: 'contrats', titre: 'Contrats', chemin: '/m/contrats' },
			{ cle: 'documents', titre: 'Documents', chemin: '/m/documents' }
		]
	}
];
