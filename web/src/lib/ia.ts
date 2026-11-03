import { pb } from './pb';

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

export async function rediger(params: {
	type: TypeCourrier;
	copropriete_id: string;
	source_type?: 'demande' | 'visite' | 'reunion' | 'chantier';
	source_id?: string;
	destinataire?: string;
	consignes?: string;
}): Promise<Brouillon> {
	if (!navigator.onLine) throw new Error('La rédaction IA nécessite une connexion.');
	const r = await fetch('/ia/redaction', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: pb.authStore.token },
		body: JSON.stringify(params)
	});
	if (!r.ok) {
		const detail = await r.json().catch(() => ({}));
		throw new Error(detail.detail ?? `Erreur ${r.status}`);
	}
	return r.json();
}
