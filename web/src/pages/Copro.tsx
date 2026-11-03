import { useQuery, useStatus } from '@powersync/react';
import { useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useEnAttente } from '../components/EtatSync';
import { creer } from '../lib/db';
import { fDate, fTags } from '../lib/format';
import { rediger, type TypeCourrier } from '../lib/ia';
import { TYPES_COURRIER } from '../lib/libelles';
import { module } from '../modules/definitions';
import { FormulaireModule } from '../modules/FormulaireModule';
import { ListeModule } from '../modules/ListeModule';

const ONGLETS = [
	{ cle: 'apercu', titre: "Vue d'ensemble" },
	{ cle: 'demandes', titre: 'Demandes' },
	{ cle: 'taches', titre: 'Tâches' },
	{ cle: 'travaux', titre: 'Travaux' },
	{ cle: 'devis', titre: 'Devis' },
	{ cle: 'courriers', titre: 'Courriers' },
	{ cle: 'visites', titre: 'Visites' },
	{ cle: 'reunions', titre: 'Réunions' },
	{ cle: 'lots', titre: 'Lots' },
	{ cle: 'personnes', titre: 'Personnes' },
	{ cle: 'contrats', titre: 'Contrats' },
	{ cle: 'documents', titre: 'Documents' }
];

interface Copropriete {
	id: string;
	nom: string;
	alias: string | null;
	adresse: string;
	code_postal: string | null;
	ville: string | null;
	nb_lots: number | null;
	syndic_depuis: string | null;
	notes: string | null;
}

const COMPTES = `SELECT
	(SELECT count(*) FROM demande WHERE copropriete_id = ?1 AND statut NOT IN ('resolue', 'close')) AS demandes,
	(SELECT count(*) FROM tache WHERE copropriete_id = ?1 AND statut IN ('a_faire', 'en_cours')) AS taches,
	(SELECT count(*) FROM chantier WHERE copropriete_id = ?1 AND statut NOT IN ('receptionne', 'abandonne')) AS travaux,
	(SELECT count(*) FROM devis WHERE copropriete_id = ?1 AND statut IN ('demande', 'recu')) AS devis,
	(SELECT count(*) FROM courrier WHERE copropriete_id = ?1) AS courriers,
	(SELECT count(*) FROM visite WHERE copropriete_id = ?1) AS visites,
	(SELECT count(*) FROM reunion WHERE copropriete_id = ?1) AS reunions,
	(SELECT count(*) FROM lot WHERE copropriete_id = ?1) AS lots,
	(SELECT count(*) FROM personne WHERE copropriete_id = ?1) AS personnes,
	(SELECT count(*) FROM contrat WHERE copropriete_id = ?1) AS contrats,
	(SELECT count(*) FROM document WHERE copropriete_id = ?1) AS documents`;

const LIBELLES_COMPTES: Record<string, string> = {
	demandes: 'demandes ouvertes',
	taches: 'tâches à faire',
	travaux: 'chantiers en cours',
	devis: 'devis en attente',
	courriers: 'courriers',
	visites: 'visites',
	reunions: 'réunions',
	lots: 'lots',
	personnes: 'personnes',
	contrats: 'contrats',
	documents: 'documents'
};

export function Copro() {
	const { id = '' } = useParams();
	const [params, setParams] = useSearchParams();
	const onglet = params.get('onglet') ?? 'apercu';
	const { data, isLoading } = useQuery<Copropriete>('SELECT * FROM copropriete WHERE id = ?', [id]);
	const { data: comptes } = useQuery<Record<string, number>>(COMPTES, [id]);
	const [edition, setEdition] = useState(false);
	const c = data[0];

	const choisir = (cle: string) => setParams(cle === 'apercu' ? {} : { onglet: cle });

	if (!c) return isLoading ? null : <p className="vide">Copropriété introuvable. <Link to="/m/coproprietes">Voir toutes les copropriétés</Link></p>;

	const m = module(onglet);
	const alias = fTags(c.alias);
	return (
		<>
			<div className="entete-page entete-copro">
				<div>
					<Link className="retour" to="/m/coproprietes">
						Copropriétés
					</Link>
					<h1>{c.nom}</h1>
					<p className="secondaire">
						{[c.adresse, c.code_postal, c.ville].filter(Boolean).join(' ')}
						{alias.length > 0 && <> · aussi appelée {alias.join(', ')}</>}
					</p>
				</div>
				<button className="secondaire-btn" onClick={() => setEdition(true)}>
					Modifier la fiche
				</button>
			</div>

			<nav className="onglets onglets-copro" aria-label="Sections de la copropriété">
				{ONGLETS.map((o) => (
					<button key={o.cle} className={o.cle === onglet ? 'active' : ''} aria-current={o.cle === onglet ? 'page' : undefined} onClick={() => choisir(o.cle)}>
						{o.titre}
						{o.cle !== 'apercu' && comptes[0]?.[o.cle] ? <span className="nb">{comptes[0][o.cle]}</span> : null}
					</button>
				))}
			</nav>

			{onglet === 'apercu' && (
				<div className="apercu">
					<dl className="infos">
						<div>
							<dt>Adresse</dt>
							<dd>{[c.adresse, c.code_postal, c.ville].filter(Boolean).join(' ') || '—'}</dd>
						</div>
						<div>
							<dt>Nombre de lots</dt>
							<dd>{c.nb_lots ?? '—'}</dd>
						</div>
						<div>
							<dt>Syndic depuis le</dt>
							<dd>{fDate(c.syndic_depuis) || '—'}</dd>
						</div>
						{c.notes && (
							<div className="large">
								<dt>Notes</dt>
								<dd className="notes">{c.notes}</dd>
							</div>
						)}
					</dl>
					<ul className="raccourcis">
						{Object.entries(LIBELLES_COMPTES).map(([cle, libelle]) => (
							<li key={cle}>
								<button onClick={() => choisir(cle)}>
									<strong>{comptes[0]?.[cle] ?? 0}</strong> {libelle}
								</button>
							</li>
						))}
					</ul>
				</div>
			)}

			{onglet === 'courriers' && <RedactionIA coproId={id} sourceInitiale={params.get('source') ?? ''} />}
			{m && m.parCopro && <ListeModule key={m.cle} m={m} coproId={id} />}

			{edition && <FormulaireModule m={module('coproprietes')!} id={id} onFermer={() => setEdition(false)} />}
		</>
	);
}

function RedactionIA({ coproId, sourceInitiale }: { coproId: string; sourceInitiale: string }) {
	const { data: demandes } = useQuery<{ id: string; titre: string }>(
		"SELECT id, titre FROM demande WHERE copropriete_id = ? ORDER BY statut IN ('resolue', 'close'), created DESC",
		[coproId]
	);
	const enAttente = useEnAttente();
	const statut = useStatus();
	const [ouvert, setOuvert] = useState(Boolean(sourceInitiale));
	const [ia, setIa] = useState({ type: 'reponse_coproprietaire' as TypeCourrier, source: sourceInitiale, destinataire: '', consignes: '' });
	const [brouillon, setBrouillon] = useState<{ objet: string; corps: string } | null>(null);
	const [enCours, setEnCours] = useState(false);
	const [erreur, setErreur] = useState('');
	const [enregistre, setEnregistre] = useState(false);
	const enLigne = navigator.onLine && statut.connected;

	async function lancer(e: FormEvent) {
		e.preventDefault();
		setEnCours(true);
		setErreur('');
		setEnregistre(false);
		try {
			const b = await rediger({
				type: ia.type,
				copropriete_id: coproId,
				source_type: ia.source ? 'demande' : undefined,
				source_id: ia.source || undefined,
				destinataire: ia.destinataire || undefined,
				consignes: ia.consignes || undefined
			});
			setBrouillon({ objet: b.objet, corps: b.corps });
		} catch (err) {
			setErreur((err as Error).message);
		} finally {
			setEnCours(false);
		}
	}

	async function enregistrer() {
		if (!brouillon) return;
		await creer('courrier', {
			copropriete_id: coproId,
			type: ia.type,
			destinataire: ia.destinataire || '—',
			objet: brouillon.objet,
			corps: brouillon.corps,
			statut: 'brouillon',
			source_type: ia.source ? 'demande' : null,
			source_id: ia.source || null
		});
		setBrouillon(null);
		setEnregistre(true);
		setIa({ ...ia, consignes: '' });
	}

	if (!ouvert) {
		return (
			<div className="appel-ia">
				<p>Un courrier à écrire ? L'IA prépare un brouillon à partir de la fiche et de la demande choisie.</p>
				<button className="principal" onClick={() => setOuvert(true)}>
					Rédiger avec l’IA
				</button>
			</div>
		);
	}

	return (
		<section className="redaction-ia">
			<form onSubmit={lancer} className="fiche">
				<div className="champs">
					<label>
						<span>Type de courrier</span>
						<select value={ia.type} onChange={(e) => setIa({ ...ia, type: e.target.value as TypeCourrier })}>
							{Object.entries(TYPES_COURRIER).map(([v, l]) => (
								<option key={v} value={v}>
									{l}
								</option>
							))}
						</select>
					</label>
					<label>
						<span>À propos de</span>
						<select value={ia.source} onChange={(e) => setIa({ ...ia, source: e.target.value })}>
							<option value="">— Aucune demande —</option>
							{demandes.map((d) => (
								<option key={d.id} value={d.id}>
									{d.titre}
								</option>
							))}
						</select>
					</label>
					<label>
						<span>Destinataire</span>
						<input value={ia.destinataire} onChange={(e) => setIa({ ...ia, destinataire: e.target.value })} placeholder="Mme Marie Dupont" />
					</label>
					<label className="large">
						<span>Consignes</span>
						<textarea rows={2} value={ia.consignes} onChange={(e) => setIa({ ...ia, consignes: e.target.value })} placeholder="Rappeler le passage du plombier prévu jeudi" />
					</label>
				</div>
				{ia.source && enAttente.has(ia.source) && <p className="aide">Cette demande n'est pas encore synchronisée : l'IA ne la verra qu'après envoi.</p>}
				{erreur && <p className="erreur">{erreur}</p>}
				{enregistre && <p className="aide">Brouillon enregistré dans la liste des courriers ci-dessous.</p>}
				<div className="pied-fiche">
					<button type="submit" className="principal" disabled={enCours || !enLigne}>
						{enCours ? 'Rédaction…' : enLigne ? 'Rédiger avec l’IA' : 'Rédaction IA indisponible hors ligne'}
					</button>
					<button type="button" className="secondaire-btn" onClick={() => (setOuvert(false), setBrouillon(null))}>
						Fermer
					</button>
				</div>
			</form>

			{brouillon && (
				<div className="fiche brouillon">
					<div className="champs">
						<label className="large">
							<span>Objet</span>
							<input value={brouillon.objet} onChange={(e) => setBrouillon({ ...brouillon, objet: e.target.value })} />
						</label>
						<label className="large">
							<span>Texte</span>
							<textarea rows={16} value={brouillon.corps} onChange={(e) => setBrouillon({ ...brouillon, corps: e.target.value })} />
						</label>
					</div>
					<div className="pied-fiche">
						<button className="principal" onClick={enregistrer}>
							Enregistrer le brouillon
						</button>
						<button className="secondaire-btn" onClick={() => setBrouillon(null)}>
							Abandonner
						</button>
					</div>
				</div>
			)}
		</section>
	);
}
