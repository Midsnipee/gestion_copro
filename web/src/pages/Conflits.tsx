import { useQuery } from '@powersync/react';
import { TABLES, estTable } from '@copro/shared/tables';
import { modifier, supprimer } from '../lib/db';
import { dateCourte } from '../lib/libelles';

interface Conflit {
	id: string;
	nature: 'concurrence' | 'rejet';
	table_cible: string;
	ligne_id: string;
	operation: string;
	donnees_appareil: string | null;
	donnees_serveur: string | null;
	message: string | null;
	created: string;
}

const lire = (j: string | null): Record<string, unknown> => {
	try {
		return j ? JSON.parse(j) ?? {} : {};
	} catch {
		return {};
	}
};

const afficher = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** Écritures que le serveur n'a pas appliquées : l'utilisatrice choisit la version à garder. */
export function Conflits() {
	const { data: conflits } = useQuery<Conflit>('SELECT * FROM conflit ORDER BY created DESC');

	async function reappliquer(c: Conflit) {
		if (!estTable(c.table_cible)) return;
		const autorisees = TABLES[c.table_cible] as Record<string, string>;
		const valeurs = Object.fromEntries(Object.entries(lire(c.donnees_appareil)).filter(([k]) => Object.hasOwn(autorisees, k)));
		// La fiche locale porte maintenant la version serveur : la modification repart sur cette base
		if (Object.keys(valeurs).length) await modifier(c.table_cible, c.ligne_id, valeurs);
		await supprimer('conflit', c.id);
	}

	if (conflits.length === 0) {
		return (
			<>
				<h1>Conflits</h1>
				<p className="vide">Aucun conflit : toutes les modifications ont été appliquées.</p>
			</>
		);
	}

	return (
		<>
			<h1>
				Conflits <span className="compte">{conflits.length}</span>
			</h1>
			<p className="secondaire">
				Ces modifications n'ont pas été appliquées sur le serveur. La fiche affiche aujourd'hui la version du serveur.
			</p>
			{conflits.map((c) => {
				const appareil = lire(c.donnees_appareil);
				const serveur = lire(c.donnees_serveur);
				const champs = Object.keys(appareil).filter((k) => !['version', 'created', 'updated', 'id'].includes(k));
				return (
					<div key={c.id} className="carte conflit">
						<div className="entete">
							<strong>
								{c.nature === 'concurrence' ? 'Modifiée sur un autre appareil' : 'Refusée par le serveur'} · {c.table_cible}
							</strong>
							<span className="secondaire">{dateCourte(c.created)}</span>
						</div>
						{c.message && <p className="secondaire">{c.message}</p>}
						{champs.length > 0 && (
							<table>
								<thead>
									<tr>
										<th>Champ</th>
										<th>Votre modification</th>
										{c.nature === 'concurrence' && <th>Version actuelle</th>}
									</tr>
								</thead>
								<tbody>
									{champs.map((k) => (
										<tr key={k}>
											<td>{k}</td>
											<td>{afficher(appareil[k])}</td>
											{c.nature === 'concurrence' && <td>{afficher(serveur[k])}</td>}
										</tr>
									))}
								</tbody>
							</table>
						)}
						<div className="ligne">
							{c.nature === 'concurrence' && <button onClick={() => reappliquer(c)}>Appliquer ma modification</button>}
							<button className="secondaire-btn" onClick={() => supprimer('conflit', c.id)}>
								{c.nature === 'concurrence' ? 'Garder la version actuelle' : 'Ignorer'}
							</button>
						</div>
					</div>
				);
			})}
		</>
	);
}
