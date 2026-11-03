import { useQuery } from '@powersync/react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { BadgeLocal, useEnAttente } from '../components/EtatSync';
import { creer } from '../lib/db';

interface Copro {
	id: string;
	nom: string;
	adresse: string;
	ville: string | null;
	alias: string | null;
	ouvertes: number;
}

const normaliser = (s: unknown) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function Copros() {
	const { data: copros, isLoading } = useQuery<Copro>(`
		SELECT c.id, c.nom, c.adresse, c.ville, c.alias,
			(SELECT count(*) FROM demande d WHERE d.copropriete_id = c.id AND d.statut NOT IN ('resolue', 'close')) AS ouvertes
		FROM copropriete c ORDER BY c.nom COLLATE NOCASE`);
	const enAttente = useEnAttente();
	const [recherche, setRecherche] = useState('');
	const [ajout, setAjout] = useState(false);
	const [form, setForm] = useState({ nom: '', adresse: '', ville: '' });

	const filtrees = useMemo(() => {
		const q = normaliser(recherche);
		if (!q) return copros;
		return copros.filter((c) => [c.nom, c.adresse, c.ville, c.alias].some((v) => normaliser(v).includes(q)));
	}, [copros, recherche]);

	async function soumettre(e: FormEvent) {
		e.preventDefault();
		await creer('copropriete', { ...form, alias: '[]' });
		setForm({ nom: '', adresse: '', ville: '' });
		setAjout(false);
	}

	return (
		<>
			<div className="entete">
				<h1>
					Copropriétés <span className="compte">{copros.length}</span>
				</h1>
				<button onClick={() => setAjout(!ajout)}>{ajout ? 'Annuler' : '+ Copropriété'}</button>
			</div>

			{ajout && (
				<form className="carte formulaire" onSubmit={soumettre}>
					<label>
						Nom
						<input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required placeholder="Résidence Les Tilleuls" />
					</label>
					<label>
						Adresse
						<input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} required placeholder="12 rue des Lilas" />
					</label>
					<label>
						Ville
						<input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
					</label>
					<button type="submit">Créer</button>
				</form>
			)}

			<input className="recherche" type="search" placeholder="Rechercher par nom, adresse, alias…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />

			{!isLoading && copros.length === 0 ? (
				<p className="vide">Aucune copropriété pour l'instant.</p>
			) : (
				<ul className="liste">
					{filtrees.map((c) => (
						<li key={c.id}>
							<Link to={`/copro/${c.id}`}>
								<strong>{c.nom}</strong>
								<span className="secondaire">
									{c.adresse}
									{c.ville ? `, ${c.ville}` : ''}
								</span>
								<span className="badges">
									{c.ouvertes > 0 && <span className="badge">{c.ouvertes} demande(s) ouverte(s)</span>}
									<BadgeLocal id={c.id} enAttente={enAttente} />
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</>
	);
}
