import { useQuery } from '@powersync/react';
import { Link } from 'react-router';
import { fDate, relatif } from '../lib/format';
import { lireSession } from '../lib/session';

interface Element {
	nature: 'demande' | 'tache' | 'contrat' | 'reunion' | 'devis';
	id: string;
	titre: string;
	detail: string | null;
	copro_id: string | null;
	copro: string | null;
	quand: string;
	critique: number;
}

const NATURE: Record<Element['nature'], { libelle: string; onglet: string; module: string }> = {
	demande: { libelle: 'Demande', onglet: 'demandes', module: 'demandes' },
	tache: { libelle: 'Tâche', onglet: 'taches', module: 'taches' },
	contrat: { libelle: 'Contrat', onglet: 'contrats', module: 'contrats' },
	reunion: { libelle: 'Réunion', onglet: 'reunions', module: 'reunions' },
	devis: { libelle: 'Devis', onglet: 'devis', module: 'devis' }
};

const A_TRAITER = `
SELECT * FROM (
	SELECT 'demande' AS nature, d.id, d.titre,
		CASE d.priorite WHEN 'urgente' THEN 'Urgente' WHEN 'haute' THEN 'Priorité haute' ELSE 'Échéance' END AS detail,
		d.copropriete_id AS copro_id, c.nom AS copro,
		coalesce(d.echeance, substr(d.created, 1, 10)) AS quand,
		(d.priorite = 'urgente' OR d.echeance < date('now')) AS critique
	FROM demande d LEFT JOIN copropriete c ON c.id = d.copropriete_id
	WHERE d.statut NOT IN ('resolue', 'close')
		AND (d.priorite IN ('urgente', 'haute') OR d.echeance <= date('now', '+7 day'))
	UNION ALL
	SELECT 'tache', t.id, t.titre, 'Tâche', t.copropriete_id, c.nom, t.echeance, t.echeance < date('now')
	FROM tache t LEFT JOIN copropriete c ON c.id = t.copropriete_id
	WHERE t.statut IN ('a_faire', 'en_cours') AND t.echeance <= date('now', '+7 day')
	UNION ALL
	SELECT 'contrat', k.id, k.objet,
		'Fin le ' || strftime('%d/%m/%Y', k.date_fin) || CASE WHEN coalesce(k.preavis_mois, 0) > 0 THEN ' · préavis de ' || k.preavis_mois || ' mois' ELSE '' END,
		k.copropriete_id, c.nom, date(k.date_fin, '-' || coalesce(k.preavis_mois, 0) || ' months'), 0
	FROM contrat k LEFT JOIN copropriete c ON c.id = k.copropriete_id
	WHERE k.date_fin >= date('now') AND date(k.date_fin, '-' || coalesce(k.preavis_mois, 0) || ' months') <= date('now', '+60 day')
	UNION ALL
	SELECT 'reunion', r.id,
		CASE r.type WHEN 'conseil_syndical' THEN 'Conseil syndical' WHEN 'ag_ordinaire' THEN 'AG ordinaire' ELSE 'AG extraordinaire' END,
		coalesce(r.lieu, ''), r.copropriete_id, c.nom, substr(r.date, 1, 10), 0
	FROM reunion r LEFT JOIN copropriete c ON c.id = r.copropriete_id
	WHERE substr(r.date, 1, 10) BETWEEN date('now') AND date('now', '+30 day')
	UNION ALL
	SELECT 'devis', v.id, coalesce(e.raison_sociale, 'Devis'), 'Devis reçu, valable jusqu''au ' || strftime('%d/%m/%Y', v.validite),
		v.copropriete_id, c.nom, v.validite, 0
	FROM devis v LEFT JOIN copropriete c ON c.id = v.copropriete_id LEFT JOIN entreprise e ON e.id = v.entreprise_id
	WHERE v.statut = 'recu' AND v.validite BETWEEN date('now') AND date('now', '+15 day')
) ORDER BY quand, critique DESC LIMIT 40`;

const COMPTEURS = `SELECT
	(SELECT count(*) FROM demande WHERE statut NOT IN ('resolue', 'close')) AS demandes,
	(SELECT count(*) FROM demande WHERE statut NOT IN ('resolue', 'close') AND priorite = 'urgente') AS urgentes,
	(SELECT count(*) FROM tache WHERE statut IN ('a_faire', 'en_cours') AND echeance < date('now')) AS taches_retard,
	(SELECT count(*) FROM chantier WHERE statut NOT IN ('receptionne', 'abandonne')) AS chantiers,
	(SELECT count(*) FROM devis WHERE statut IN ('demande', 'recu')) AS devis,
	(SELECT count(*) FROM courrier WHERE statut = 'brouillon') AS brouillons,
	(SELECT count(*) FROM copropriete) AS copros,
	(SELECT count(*) FROM conflit) AS conflits`;

const PAR_COPRO = `SELECT c.id, c.nom, count(d.id) AS ouvertes,
	sum(d.priorite = 'urgente') AS urgentes
	FROM copropriete c JOIN demande d ON d.copropriete_id = c.id AND d.statut NOT IN ('resolue', 'close')
	GROUP BY c.id ORDER BY ouvertes DESC, c.nom LIMIT 8`;

const RECENT = `SELECT * FROM (
	SELECT 'demandes' AS onglet, d.id, d.titre, d.copropriete_id AS copro_id, c.nom AS copro, d.updated, 'Demande' AS nature
		FROM demande d LEFT JOIN copropriete c ON c.id = d.copropriete_id
	UNION ALL SELECT 'courriers', k.id, coalesce(k.objet, 'Courrier'), k.copropriete_id, c.nom, k.updated, 'Courrier'
		FROM courrier k LEFT JOIN copropriete c ON c.id = k.copropriete_id
	UNION ALL SELECT 'visites', v.id, 'Visite du ' || strftime('%d/%m', v.date), v.copropriete_id, c.nom, v.updated, 'Visite'
		FROM visite v LEFT JOIN copropriete c ON c.id = v.copropriete_id
) ORDER BY updated DESC LIMIT 7`;

function lien(e: Element) {
	const n = NATURE[e.nature];
	return e.copro_id ? `/copro/${e.copro_id}?onglet=${n.onglet}&fiche=${e.id}` : `/m/${n.module}?fiche=${e.id}`;
}

function periode(quand: string) {
	const auj = new Date().toISOString().slice(0, 10);
	const dans7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
	if (quand < auj) return 'retard';
	if (quand <= dans7) return 'semaine';
	return 'plus-tard';
}

const PERIODES = [
	{ cle: 'retard', titre: 'En retard' },
	{ cle: 'semaine', titre: 'Cette semaine' },
	{ cle: 'plus-tard', titre: 'À venir' }
];

export function TableauDeBord() {
	const { data: elements, isLoading } = useQuery<Element>(A_TRAITER);
	const { data: c } = useQuery<Record<string, number>>(COMPTEURS);
	const { data: parCopro } = useQuery<{ id: string; nom: string; ouvertes: number; urgentes: number }>(PAR_COPRO);
	const { data: recent } = useQuery<{ onglet: string; id: string; titre: string; copro_id: string; copro: string; updated: string; nature: string }>(RECENT);
	const k = c[0] ?? {};
	const max = Math.max(1, ...parCopro.map((p) => p.ouvertes));
	const nom = lireSession()?.utilisateur.nom.split(' ')[0];
	const aujourdhui = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

	return (
		<div className="accueil">
			<div className="entete-page">
				<h1>Bonjour {nom}</h1>
				<p className="date-du-jour">{aujourdhui.charAt(0).toUpperCase() + aujourdhui.slice(1)}</p>
			</div>

			<dl className="releve">
				<Link to="/m/demandes">
					<dt>Demandes ouvertes</dt>
					<dd>{k.demandes ?? 0}</dd>
				</Link>
				<Link to="/m/demandes" className={k.urgentes ? 'alerte' : ''}>
					<dt>Urgentes</dt>
					<dd>{k.urgentes ?? 0}</dd>
				</Link>
				<Link to="/m/taches" className={k.taches_retard ? 'attention' : ''}>
					<dt>Tâches en retard</dt>
					<dd>{k.taches_retard ?? 0}</dd>
				</Link>
				<Link to="/m/travaux">
					<dt>Chantiers en cours</dt>
					<dd>{k.chantiers ?? 0}</dd>
				</Link>
				<Link to="/m/devis">
					<dt>Devis en attente</dt>
					<dd>{k.devis ?? 0}</dd>
				</Link>
				<Link to="/m/courriers">
					<dt>Courriers à finir</dt>
					<dd>{k.brouillons ?? 0}</dd>
				</Link>
			</dl>

			{k.conflits > 0 && (
				<Link to="/conflits" className="bandeau-conflits">
					{k.conflits} modification(s) n'ont pas pu être appliquées : choisir la version à garder
				</Link>
			)}

			<div className="colonnes-accueil">
				<section className="a-traiter" aria-labelledby="titre-a-traiter">
					<h2 id="titre-a-traiter">À traiter</h2>
					{!isLoading && elements.length === 0 && (
						<p className="vide">
							Rien d'urgent : aucune échéance dans les 7 prochains jours.
							{k.copros === 0 && (
								<>
									{' '}
									Commencez par <Link to="/m/coproprietes?fiche=nouveau">ajouter une copropriété</Link>.
								</>
							)}
						</p>
					)}
					{PERIODES.map((p) => {
						const liste = elements.filter((e) => periode(e.quand) === p.cle);
						if (!liste.length) return null;
						return (
							<div key={p.cle} className={`periode ${p.cle}`}>
								<h3>
									{p.titre} <span className="nb">{liste.length}</span>
								</h3>
								<ol>
									{liste.map((e) => (
										<li key={e.nature + e.id} className={e.critique ? 'critique' : ''}>
											<time dateTime={e.quand} title={fDate(e.quand)}>
												<span className="jour">{fDate(e.quand).slice(0, 5)}</span>
												<span className="rel">{relatif(e.quand)}</span>
											</time>
											<Link to={lien(e)}>
												<span className="nature" data-nature={e.nature}>
													{NATURE[e.nature].libelle}
												</span>
												<strong>{e.titre}</strong>
												<span className="contexte">
													{e.copro}
													{e.detail ? ` — ${e.detail}` : ''}
												</span>
											</Link>
										</li>
									))}
								</ol>
							</div>
						);
					})}
				</section>

				<aside className="cote-accueil">
					<section aria-labelledby="titre-par-copro">
						<h2 id="titre-par-copro">Demandes ouvertes par copropriété</h2>
						{parCopro.length === 0 ? (
							<p className="vide">Aucune demande ouverte.</p>
						) : (
							<ul className="barres">
								{parCopro.map((p) => (
									<li key={p.id}>
										<Link to={`/copro/${p.id}?onglet=demandes`}>
											<span className="nom">{p.nom}</span>
											<span className="barre" aria-hidden="true">
												<span style={{ width: `${(p.ouvertes / max) * 100}%` }} />
											</span>
											<span className="num">
												{p.ouvertes}
												{p.urgentes > 0 && <span className="dont-urgentes" title="dont urgentes"> · {p.urgentes} urg.</span>}
											</span>
										</Link>
									</li>
								))}
							</ul>
						)}
					</section>

					<section aria-labelledby="titre-recent">
						<h2 id="titre-recent">Modifié récemment</h2>
						{recent.length === 0 ? (
							<p className="vide">Rien pour l'instant.</p>
						) : (
							<ul className="recent">
								{recent.map((r) => (
									<li key={r.onglet + r.id}>
										<Link to={`/copro/${r.copro_id}?onglet=${r.onglet}&fiche=${r.id}`}>
											<strong>{r.titre}</strong>
											<span>
												{r.nature} · {r.copro} · {relatif(r.updated)}
											</span>
										</Link>
									</li>
								))}
							</ul>
						)}
					</section>
				</aside>
			</div>
		</div>
	);
}
