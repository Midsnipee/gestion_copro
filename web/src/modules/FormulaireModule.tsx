import { useQuery } from '@powersync/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useEnAttente } from '../components/EtatSync';
import { creer, modifier, supprimer } from '../lib/db';
import { fDateHeure, fTags, pourInputDate, pourInputDateHeure } from '../lib/format';
import type { Champ, Module } from './definitions';

type Valeurs = Record<string, unknown>;

/** Valeur de formulaire (texte) -> valeur stockée (SQLite local). */
function versStockage(c: Champ, v: unknown): unknown {
	if (v === '' || v === undefined) return null;
	switch (c.type) {
		case 'number':
			return Number(String(v).replace(',', '.'));
		case 'bool':
			return v ? 1 : 0;
		case 'tags':
			return JSON.stringify(
				String(v)
					.split(',')
					.map((x) => x.trim())
					.filter(Boolean)
			);
		case 'datetime':
			return new Date(String(v)).toISOString();
		default:
			return v;
	}
}

function versFormulaire(c: Champ, v: unknown): string | boolean {
	if (v === null || v === undefined) return c.type === 'bool' ? false : '';
	switch (c.type) {
		case 'tags':
			return fTags(v).join(', ');
		case 'date':
			return pourInputDate(v);
		case 'datetime':
			return pourInputDateHeure(v);
		case 'bool':
			return Boolean(Number(v));
		default:
			return String(v);
	}
}

function ChoixRef({ c, valeur, copro, onChange }: { c: Extract<Champ, { type: 'ref' }>; valeur: string; copro: string; onChange: (v: string) => void }) {
	const filtre = c.memeCopro && copro ? 'WHERE copropriete_id = ?' : '';
	const { data } = useQuery<{ id: string; libelle: string }>(
		`SELECT id, ${c.affichage} AS libelle FROM ${c.table} ${filtre} ORDER BY libelle COLLATE NOCASE LIMIT 1000`,
		filtre ? [copro] : []
	);
	return (
		<select value={valeur} onChange={(e) => onChange(e.target.value)} required={c.requis}>
			<option value="">{c.requis ? 'Choisir…' : '—'}</option>
			{data.map((o) => (
				<option key={o.id} value={o.id}>
					{o.libelle}
				</option>
			))}
		</select>
	);
}

/** Fiche d'un module dans un tiroir latéral : création, modification, suppression. */
export function FormulaireModule({ m, id, valeursInitiales, onFermer }: { m: Module; id: string | null; valeursInitiales?: Valeurs; onFermer: () => void }) {
	const { data, isLoading } = useQuery<Valeurs>(`SELECT * FROM ${m.table} WHERE id = ?`, [id ?? '']);
	const existant = id ? data[0] : undefined;
	const [f, setF] = useState<Record<string, string | boolean>>({});
	const [erreur, setErreur] = useState('');
	const [charge, setCharge] = useState(false);
	const enAttente = useEnAttente();
	const premier = useRef<HTMLDivElement>(null);

	// Initialisation unique (les mises à jour reçues pendant l'édition ne l'écrasent pas)
	useEffect(() => {
		if (charge || (id && isLoading)) return;
		const source = existant ?? valeursInitiales ?? {};
		setF(
			Object.fromEntries(
				m.champs.map((c) => [c.nom, versFormulaire(c, source[c.nom] ?? (!existant && c.type === 'select' ? (c.defaut ?? '') : null))])
			)
		);
		setCharge(true);
	}, [charge, id, isLoading, existant, valeursInitiales, m.champs]);

	useEffect(() => {
		const echap = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
		window.addEventListener('keydown', echap);
		premier.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
		return () => window.removeEventListener('keydown', echap);
	}, [onFermer, charge]);

	async function enregistrer(e: FormEvent) {
		e.preventDefault();
		setErreur('');
		try {
			if (!existant) {
				const valeurs = Object.fromEntries(m.champs.map((c) => [c.nom, versStockage(c, f[c.nom])]).filter(([, v]) => v !== null));
				await creer(m.table, valeurs);
			} else {
				// Seuls les champs changés partent : moins de conflits entre appareils
				const changes = Object.fromEntries(
					m.champs.filter((c) => versFormulaire(c, existant[c.nom]) !== f[c.nom]).map((c) => [c.nom, versStockage(c, f[c.nom])])
				);
				if (Object.keys(changes).length) await modifier(m.table, String(existant.id), changes);
			}
			onFermer();
		} catch (err) {
			setErreur((err as Error).message);
		}
	}

	async function effacer() {
		if (!existant || !confirm(`Supprimer définitivement ${m.unite} ?`)) return;
		await supprimer(m.table, String(existant.id));
		onFermer();
	}

	if (id && !isLoading && !existant) {
		return (
			<Tiroir titre={m.titre} onFermer={onFermer}>
				<p className="vide">Cette fiche n'existe plus.</p>
			</Tiroir>
		);
	}

	const copro = String(f.copropriete_id ?? '');
	return (
		<Tiroir titre={existant ? `Modifier ${m.unite}` : `Ajouter ${m.unite}`} onFermer={onFermer}>
			{charge && (
				<form className="fiche" onSubmit={enregistrer}>
					<div className="champs" ref={premier}>
						{m.champs.map((c) => (
							<label key={c.nom} className={'large' in c && c.large ? 'large' : c.type === 'textarea' ? 'large' : ''}>
								<span>
									{c.libelle}
									{'requis' in c && c.requis && <abbr title="obligatoire"> *</abbr>}
								</span>
								{c.type === 'textarea' ? (
									<textarea rows={c.nom === 'corps' || c.nom === 'pv' || c.nom === 'rapport' ? 10 : 4} value={String(f[c.nom] ?? '')} onChange={(e) => setF({ ...f, [c.nom]: e.target.value })} required={c.requis} />
								) : c.type === 'select' ? (
									<select value={String(f[c.nom] ?? '')} onChange={(e) => setF({ ...f, [c.nom]: e.target.value })} required={c.requis}>
										{!c.requis && <option value="">—</option>}
										{Object.entries(c.options).map(([v, l]) => (
											<option key={v} value={v}>
												{l}
											</option>
										))}
									</select>
								) : c.type === 'ref' ? (
									<ChoixRef c={c} valeur={String(f[c.nom] ?? '')} copro={copro} onChange={(v) => setF({ ...f, [c.nom]: v })} />
								) : c.type === 'bool' ? (
									<input type="checkbox" checked={Boolean(f[c.nom])} onChange={(e) => setF({ ...f, [c.nom]: e.target.checked })} />
								) : (
									<span className="avec-unite">
										<input
											type={c.type === 'tags' ? 'text' : c.type === 'datetime' ? 'datetime-local' : c.type === 'number' ? 'text' : c.type}
											inputMode={c.type === 'number' ? 'decimal' : undefined}
											value={String(f[c.nom] ?? '')}
											onChange={(e) => setF({ ...f, [c.nom]: e.target.value })}
											required={'requis' in c ? c.requis : false}
										/>
										{c.type === 'number' && c.unite && <span className="unite">{c.unite}</span>}
									</span>
								)}
								{'aide' in c && c.aide && <small>{c.aide}</small>}
							</label>
						))}
					</div>
					{erreur && <p className="erreur">{erreur}</p>}
					{existant && (
						<p className="meta-fiche">
							Créée le {fDateHeure(existant.created)} · modifiée le {fDateHeure(existant.updated)}
							{enAttente.has(String(existant.id)) ? ' · enregistrée sur cet appareil, pas encore synchronisée' : ''}
						</p>
					)}
					<div className="pied-fiche">
						<button type="submit" className="principal">
							{existant ? 'Enregistrer' : 'Ajouter'}
						</button>
						<button type="button" className="secondaire-btn" onClick={onFermer}>
							Annuler
						</button>
						{existant && m.table === 'demande' && (
							<Link className="secondaire-btn bouton" to={`/copro/${String(existant.copropriete_id)}?onglet=courriers&source=${String(existant.id)}`}>
								Rédiger un courrier
							</Link>
						)}
						{existant && (
							<button type="button" className="danger-btn pousse" onClick={effacer}>
								Supprimer
							</button>
						)}
					</div>
				</form>
			)}
		</Tiroir>
	);
}

export function Tiroir({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: React.ReactNode }) {
	return (
		<div className="voile" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
			<aside className="tiroir" role="dialog" aria-modal="true" aria-label={titre}>
				<header>
					<h2>{titre}</h2>
					<button className="fermer" onClick={onFermer} aria-label="Fermer">
						×
					</button>
				</header>
				{children}
			</aside>
		</div>
	);
}
