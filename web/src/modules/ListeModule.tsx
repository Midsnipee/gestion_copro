import { useQuery } from '@powersync/react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useEnAttente } from '../components/EtatSync';
import { fDate, fDateHeure, fEuros, fNombre, fTags } from '../lib/format';
import { requeteListe } from '../lib/requete';
import { libelleValeur, type Colonne, type Module } from './definitions';
import { FormulaireModule } from './FormulaireModule';

type Ligne = Record<string, unknown> & { id: string };

/** Valeur d'une cellule, mise en forme selon la colonne. */
export function Cellule({ m, ligne, col }: { m: Module; ligne: Ligne; col: Colonne | { champ: string; format?: Colonne['format'] } }) {
	const v = ligne[col.champ];
	const champ = m.champs.find((c) => c.nom === col.champ);
	const format = col.format ?? (champ?.type === 'ref' ? 'ref' : champ?.type === 'select' ? 'statut' : champ?.type === 'date' ? 'date' : champ?.type === 'datetime' ? 'datetime' : 'texte');
	switch (format) {
		case 'ref':
			return <>{String(ligne[`${col.champ}__libelle`] ?? '')}</>;
		case 'statut':
			return v ? (
				<span className="etiquette" data-valeur={String(v)}>
					{libelleValeur(m, col.champ, v)}
				</span>
			) : null;
		case 'date':
			return <>{fDate(v)}</>;
		case 'datetime':
			return <>{fDateHeure(v)}</>;
		case 'euros':
			return <span className="num">{fEuros(v)}</span>;
		case 'nombre':
			return <span className="num">{fNombre(v)}</span>;
		case 'tags':
			return <>{fTags(v).join(', ')}</>;
		default:
			return <>{libelleValeur(m, col.champ, v)}</>;
	}
}

/** Titre lisible d'une fiche (première colonne). */
export function titreFiche(m: Module, l: Ligne) {
	const champ = m.champs.find((c) => c.nom === m.titreLigne);
	if (champ?.type === 'ref') return String(l[`${m.titreLigne}__libelle`] ?? '—');
	if (champ?.type === 'datetime') return fDateHeure(l[m.titreLigne]);
	if (champ?.type === 'select') return libelleValeur(m, m.titreLigne, l[m.titreLigne]);
	return String(l[m.titreLigne] ?? '') || 'Sans titre';
}

/**
 * Liste générique d'un module : recherche, filtres, tableau, et fiche en tiroir.
 * Avec `coproId`, la liste est limitée à une copropriété (onglets de la fiche copro).
 */
export function ListeModule({ m, coproId, valeursParDefaut }: { m: Module; coproId?: string; valeursParDefaut?: Record<string, unknown> }) {
	const [params, setParams] = useSearchParams();
	const [recherche, setRecherche] = useState('');
	const [filtres, setFiltres] = useState<Record<string, string>>({});
	const [termines, setTermines] = useState(false);
	const enAttente = useEnAttente();
	const ouverte = params.get('fiche');

	const { sql, params: p } = useMemo(() => requeteListe(m, { recherche, filtres, coproId, termines }), [m, recherche, filtres, coproId, termines]);
	const { data: lignes, isLoading } = useQuery<Ligne>(sql, p);

	const ouvrir = (id: string) => setParams((s) => (s.set('fiche', id), s));
	const fermer = () => setParams((s) => (s.delete('fiche'), s));
	const colonnes = m.colonnes.filter((c) => !(coproId && c.champ === 'copropriete_id'));
	const filtresDispo = (m.filtres ?? []).map((f) => m.champs.find((c) => c.nom === f)).filter((c) => c?.type === 'select');

	return (
		<div className="module">
			<div className="barre-liste">
				<input type="search" className="recherche-liste" placeholder={`Rechercher dans ${m.titre.toLowerCase()}`} value={recherche} onChange={(e) => setRecherche(e.target.value)} aria-label="Rechercher" />
				{filtresDispo.map(
					(c) =>
						c?.type === 'select' && (
							<select key={c.nom} value={filtres[c.nom] ?? ''} onChange={(e) => setFiltres({ ...filtres, [c.nom]: e.target.value })} aria-label={c.libelle}>
								<option value="">{c.libelle} : tous</option>
								{Object.entries(c.options).map(([v, l]) => (
									<option key={v} value={v}>
										{l}
									</option>
								))}
							</select>
						)
				)}
				{m.termine && (
					<label className="case">
						<input type="checkbox" checked={termines} onChange={(e) => setTermines(e.target.checked)} />
						Afficher les terminés
					</label>
				)}
				<button className="principal" onClick={() => ouvrir('nouveau')}>
					Ajouter {m.unite}
				</button>
			</div>

			{!isLoading && lignes.length === 0 ? (
				<div className="vide">
					<p>{recherche || Object.values(filtres).some(Boolean) ? 'Aucun résultat pour ces critères.' : `Aucune fiche pour l'instant.`}</p>
					<button className="secondaire-btn" onClick={() => ouvrir('nouveau')}>
						Ajouter {m.unite}
					</button>
				</div>
			) : (
				<table className="table-module">
					<thead>
						<tr>
							<th>{m.champs.find((c) => c.nom === m.titreLigne)?.libelle ?? 'Titre'}</th>
							{colonnes.map((c) => (
								<th key={c.champ} className={c.secondaire ? 'col-secondaire' : ''}>
									{c.libelle}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{lignes.map((l) => {
							const fini = m.termine && m.termine.valeurs.includes(String(l[m.termine.champ]));
							return (
								<tr key={l.id} onClick={() => ouvrir(l.id)} className={fini ? 'termine' : ''}>
									<td className="titre-ligne">
										{m.cle === 'coproprietes' ? (
											<Link to={`/copro/${l.id}`} onClick={(e) => e.stopPropagation()}>
												{titreFiche(m, l)}
											</Link>
										) : (
											<button className="lien-ligne" onClick={(e) => (e.stopPropagation(), ouvrir(l.id))}>
												{titreFiche(m, l)}
											</button>
										)}
										{enAttente.has(l.id) && (
											<span className="local" title="Enregistré sur cet appareil, pas encore synchronisé">
												Sur cet appareil
											</span>
										)}
									</td>
									{colonnes.map((c) => (
										<td key={c.champ} className={c.secondaire ? 'col-secondaire' : ''}>
											{c.champ === 'copropriete_id' && l.copropriete_id ? (
												<Link to={`/copro/${l.copropriete_id}`} onClick={(e) => e.stopPropagation()}>
													<Cellule m={m} ligne={l} col={c} />
												</Link>
											) : (
												<Cellule m={m} ligne={l} col={c} />
											)}
										</td>
									))}
								</tr>
							);
						})}
					</tbody>
				</table>
			)}
			{lignes.length >= 500 && <p className="aide">Seules les 500 premières fiches sont affichées : affinez la recherche.</p>}

			{ouverte && (
				<FormulaireModule
					m={m}
					id={ouverte === 'nouveau' ? null : ouverte}
					valeursInitiales={{ ...(coproId && m.parCopro ? { copropriete_id: coproId } : {}), ...valeursParDefaut }}
					onFermer={fermer}
				/>
			)}
		</div>
	);
}
