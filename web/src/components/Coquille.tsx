import { useQuery } from '@powersync/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { MENU } from '../modules/definitions';
import { db } from '../lib/db';
import { ecrireSession, type Session } from '../lib/session';
import { EtatSync } from './EtatSync';

interface Resultat {
	type: 'copro' | 'personne' | 'entreprise' | 'demande';
	id: string;
	titre: string;
	detail: string;
	copro: string | null;
}

const LIBELLE_TYPE: Record<Resultat['type'], string> = { copro: 'Copropriété', personne: 'Personne', entreprise: 'Entreprise', demande: 'Demande' };

/** Recherche globale (base locale : fonctionne hors ligne). */
function Recherche() {
	const [q, setQ] = useState('');
	const [ouvert, setOuvert] = useState(false);
	const [actif, setActif] = useState(0);
	const nav = useNavigate();
	const champ = useRef<HTMLInputElement>(null);
	const motif = `%${q.trim().toLowerCase()}%`;
	const { data } = useQuery<Resultat>(
		q.trim().length < 2
			? 'SELECT NULL AS id WHERE 0'
			: `SELECT * FROM (
				SELECT 'copro' AS type, id, nom AS titre, adresse || coalesce(', ' || ville, '') AS detail, id AS copro FROM copropriete
					WHERE lower(nom || ' ' || adresse || ' ' || coalesce(ville, '') || ' ' || coalesce(alias, '')) LIKE ?1 LIMIT 6)
			UNION ALL SELECT * FROM (
				SELECT 'personne', p.id, p.nom || coalesce(' ' || p.prenom, ''), coalesce(p.telephone, p.email, ''), p.copropriete_id FROM personne p
					WHERE lower(p.nom || ' ' || coalesce(p.prenom, '') || ' ' || coalesce(p.email, '') || ' ' || coalesce(p.telephone, '')) LIKE ?1 LIMIT 6)
			UNION ALL SELECT * FROM (
				SELECT 'entreprise', id, raison_sociale, coalesce(telephone, ''), NULL FROM entreprise
					WHERE lower(raison_sociale || ' ' || coalesce(corps_metier, '') || ' ' || coalesce(contact, '')) LIKE ?1 LIMIT 5)
			UNION ALL SELECT * FROM (
				SELECT 'demande', d.id, d.titre, (SELECT nom FROM copropriete WHERE id = d.copropriete_id), d.copropriete_id FROM demande d
					WHERE lower(d.titre) LIKE ?1 ORDER BY d.created DESC LIMIT 5)`,
		q.trim().length < 2 ? [] : [motif]
	);

	useEffect(() => {
		const raccourci = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				champ.current?.focus();
			}
		};
		window.addEventListener('keydown', raccourci);
		return () => window.removeEventListener('keydown', raccourci);
	}, []);

	function aller(r: Resultat) {
		setQ('');
		setOuvert(false);
		champ.current?.blur();
		if (r.type === 'copro') nav(`/copro/${r.id}`);
		else if (r.type === 'entreprise') nav(`/m/entreprises?fiche=${r.id}`);
		else if (r.type === 'personne') nav(`/copro/${r.copro}?onglet=personnes&fiche=${r.id}`);
		else nav(`/copro/${r.copro}?onglet=demandes&fiche=${r.id}`);
	}

	return (
		<div className="recherche-globale">
			<input
				ref={champ}
				type="search"
				placeholder="Rechercher une copro, une personne, une entreprise…  (Ctrl K)"
				value={q}
				onChange={(e) => (setQ(e.target.value), setOuvert(true), setActif(0))}
				onFocus={() => setOuvert(true)}
				onBlur={() => setTimeout(() => setOuvert(false), 150)}
				onKeyDown={(e) => {
					if (e.key === 'ArrowDown') (e.preventDefault(), setActif((a) => Math.min(a + 1, data.length - 1)));
					if (e.key === 'ArrowUp') (e.preventDefault(), setActif((a) => Math.max(a - 1, 0)));
					if (e.key === 'Enter' && data[actif]) aller(data[actif]);
					if (e.key === 'Escape') (setQ(''), champ.current?.blur());
				}}
				aria-label="Recherche globale"
			/>
			{ouvert && q.trim().length >= 2 && (
				<ul className="resultats" role="listbox">
					{data.length === 0 && <li className="aucun">Aucun résultat pour « {q} »</li>}
					{data.map((r, i) => (
						<li key={r.type + r.id} role="option" aria-selected={i === actif} className={i === actif ? 'actif' : ''} onMouseDown={() => aller(r)} onMouseEnter={() => setActif(i)}>
							<span className="type">{LIBELLE_TYPE[r.type]}</span>
							<strong>{r.titre}</strong>
							<span className="detail">{r.detail}</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export function Coquille({ session, children }: { session: Session; children: ReactNode }) {
	const [menuOuvert, setMenuOuvert] = useState(false);
	const loc = useLocation();
	const { data: conflits } = useQuery<{ n: number }>('SELECT count(*) AS n FROM conflit');
	const { data: compteurs } = useQuery<{ demandes: number; taches: number }>(`SELECT
		(SELECT count(*) FROM demande WHERE statut NOT IN ('resolue', 'close')) AS demandes,
		(SELECT count(*) FROM tache WHERE statut IN ('a_faire', 'en_cours') AND echeance IS NOT NULL AND echeance < date('now')) AS taches`);
	const nbConflits = conflits[0]?.n ?? 0;
	const pastilles: Record<string, number> = { demandes: compteurs[0]?.demandes ?? 0, taches: compteurs[0]?.taches ?? 0 };

	useEffect(() => setMenuOuvert(false), [loc.pathname]);

	async function deconnexion() {
		if (!confirm('Se déconnecter efface les données de cet appareil, y compris les modifications non synchronisées. Continuer ?')) return;
		fetch('/api/auth/deconnexion', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ renouvellement: session.renouvellement })
		}).catch(() => {});
		await db.disconnectAndClear();
		ecrireSession(null);
	}

	return (
		<div className={`coquille ${menuOuvert ? 'menu-ouvert' : ''}`}>
			<nav className="menu" aria-label="Menu principal">
				<div className="marque">
					<svg viewBox="0 0 32 32" aria-hidden="true">
						<path d="M4 28V13L16 4l12 9v15h-8v-9h-8v9z" />
					</svg>
					<span>Gestion copro</span>
				</div>
				{MENU.map((g) => (
					<div key={g.groupe || 'accueil'} className="groupe">
						{g.groupe && <p className="titre-groupe">{g.groupe}</p>}
						{g.entrees.map((e) => (
							<NavLink key={e.cle} to={e.chemin} end={e.chemin === '/'}>
								<span>{e.titre}</span>
								{pastilles[e.cle] > 0 && (
									<span className={`compte-menu ${e.cle === 'taches' ? 'retard' : ''}`} title={e.cle === 'taches' ? 'Tâches en retard' : 'Demandes ouvertes'}>
										{pastilles[e.cle]}
									</span>
								)}
							</NavLink>
						))}
					</div>
				))}
				<div className="groupe bas">
					<NavLink to="/conflits">
						<span>Conflits</span>
						{nbConflits > 0 && <span className="compte-menu alerte">{nbConflits}</span>}
					</NavLink>
					{session.utilisateur.role === 'admin' && <NavLink to="/admin">Administration</NavLink>}
				</div>
			</nav>
			<div className="voile-menu" onClick={() => setMenuOuvert(false)} />

			<div className="cadre">
				<header className="barre-haut">
					<button className="burger" onClick={() => setMenuOuvert(!menuOuvert)} aria-label="Ouvrir le menu" aria-expanded={menuOuvert}>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M3 6h18M3 12h18M3 18h18" />
						</svg>
					</button>
					<Recherche />
					<EtatSync />
					<div className="utilisateur">
						<NavLink to="/compte" title={session.utilisateur.email}>
							{session.utilisateur.nom}
						</NavLink>
						<button className="lien" onClick={deconnexion}>
							Déconnexion
						</button>
					</div>
				</header>
				<main>{children}</main>
			</div>
		</div>
	);
}
