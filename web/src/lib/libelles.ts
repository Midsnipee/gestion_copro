export const STATUTS_DEMANDE: Record<string, string> = {
	nouvelle: 'Nouvelle',
	en_cours: 'En cours',
	attente_tiers: 'Attente tiers',
	resolue: 'Résolue',
	close: 'Close'
};

export const CATEGORIES_DEMANDE: Record<string, string> = {
	fuite: 'Fuite',
	nuisance: 'Nuisance',
	sinistre: 'Sinistre',
	entretien: 'Entretien',
	travaux: 'Travaux',
	administratif: 'Administratif',
	autre: 'Autre'
};

export const PRIORITES: Record<string, string> = {
	basse: 'Basse',
	normale: 'Normale',
	haute: 'Haute',
	urgente: 'Urgente'
};

export const TYPES_COURRIER: Record<string, string> = {
	relance: 'Relance',
	mise_en_demeure: 'Mise en demeure',
	convocation: 'Convocation',
	demande_devis: 'Demande de devis',
	reponse_coproprietaire: 'Réponse à un copropriétaire',
	information: 'Information'
};

export const dateCourte = (d?: unknown) =>
	d ? new Date(String(d).replace(' ', 'T')).toLocaleDateString('fr-FR') : '';
