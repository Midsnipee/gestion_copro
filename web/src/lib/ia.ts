import { api } from './session';

export type TypeCourrier =
	| 'relance'
	| 'mise_en_demeure'
	| 'convocation'
	| 'demande_devis'
	| 'reponse_coproprietaire'
	| 'information';

export interface Brouillon {
	objet: string;
	corps: string;
	modele: string;
}

export function rediger(params: {
	type: TypeCourrier;
	copropriete_id: string;
	source_type?: 'demande';
	source_id?: string;
	destinataire?: string;
	consignes?: string;
}): Promise<Brouillon> {
	if (!navigator.onLine) return Promise.reject(new Error('La rédaction IA nécessite une connexion.'));
	return api<Brouillon>('/api/ia/redaction', params);
}
