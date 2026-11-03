import { dateHeure, useRessource } from './commun';

interface Entree {
	id: number;
	action: string;
	cible: string | null;
	details: Record<string, unknown> | null;
	created: string;
	auteur: string | null;
}

const ACTIONS: Record<string, string> = {
	initialisation: 'Premier administrateur créé',
	utilisateur_cree: 'Compte créé',
	utilisateur_modifie: 'Compte modifié',
	utilisateur_desactive: 'Compte désactivé',
	utilisateur_reactive: 'Compte réactivé',
	mot_de_passe_reinitialise: 'Mot de passe réinitialisé',
	mot_de_passe_modifie: 'Mot de passe changé par son titulaire',
	appareils_deconnectes: 'Appareils déconnectés',
	modeles_ia_modifies: 'Modèles IA modifiés'
};

function resume(d: Record<string, unknown> | null) {
	if (!d) return '';
	return Object.entries(d)
		.map(([k, v]) => {
			if (v && typeof v === 'object' && 'apres' in v) {
				const c = v as { avant?: unknown; apres: unknown };
				return `${k} : ${String(c.avant)} → ${String(c.apres)}`;
			}
			return `${k} : ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`;
		})
		.join(' · ');
}

export function Journal() {
	const { donnees, erreur } = useRessource<Entree[]>('/api/admin/journal');
	return (
		<>
			<h2>Journal d'administration</h2>
			{erreur && <p className="erreur">{erreur}</p>}
			{donnees && donnees.length === 0 && <p className="vide">Aucune action pour l'instant.</p>}
			{donnees && donnees.length > 0 && (
				<table className="tableau">
					<thead>
						<tr>
							<th>Date</th>
							<th>Par</th>
							<th>Action</th>
							<th>Concerne</th>
							<th>Détails</th>
						</tr>
					</thead>
					<tbody>
						{donnees.map((j) => (
							<tr key={j.id}>
								<td>{dateHeure(j.created)}</td>
								<td>{j.auteur ?? '—'}</td>
								<td>{ACTIONS[j.action] ?? j.action}</td>
								<td>{j.cible}</td>
								<td className="secondaire">{resume(j.details)}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</>
	);
}
