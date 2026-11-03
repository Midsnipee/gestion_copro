import { useQuery, useStatus } from '@powersync/react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { BadgeLocal, useEnAttente } from '../components/EtatSync';
import { creer, modifier } from '../lib/db';
import { rediger, type TypeCourrier } from '../lib/ia';
import { CATEGORIES_DEMANDE, PRIORITES, STATUTS_DEMANDE, TYPES_COURRIER, dateCourte } from '../lib/libelles';

interface Demande {
	id: string;
	titre: string;
	categorie: string;
	priorite: string;
	statut: string;
	created: string;
}
interface Courrier {
	id: string;
	objet: string | null;
	type: string;
	destinataire: string;
	statut: string;
	updated: string;
}

const options = (o: Record<string, string>) =>
	Object.entries(o).map(([v, l]) => (
		<option key={v} value={v}>
			{l}
		</option>
	));

export function Copro() {
	const { id = '' } = useParams();
	const { data: copros, isLoading } = useQuery<{ nom: string; adresse: string; code_postal: string | null; ville: string | null }>(
		'SELECT nom, adresse, code_postal, ville FROM copropriete WHERE id = ?',
		[id]
	);
	const { data: demandes } = useQuery<Demande>('SELECT * FROM demande WHERE copropriete_id = ? ORDER BY created DESC', [id]);
	const { data: courriers } = useQuery<Courrier>('SELECT * FROM courrier WHERE copropriete_id = ? ORDER BY updated DESC', [id]);
	const enAttente = useEnAttente();
	const statut = useStatus();

	// Nouvelle demande (fonctionne hors ligne)
	const [formDemande, setFormDemande] = useState(false);
	const [d, setD] = useState({ titre: '', description: '', categorie: 'fuite', priorite: 'normale' });

	async function creerDemande(e: FormEvent) {
		e.preventDefault();
		await creer('demande', { copropriete_id: id, ...d, statut: 'nouvelle' });
		setD({ titre: '', description: '', categorie: 'fuite', priorite: 'normale' });
		setFormDemande(false);
	}

	// Courrier rédigé par l'IA
	const [ia, setIa] = useState({ type: 'reponse_coproprietaire' as TypeCourrier, source: '', destinataire: '', consignes: '' });
	const [brouillon, setBrouillon] = useState<{ objet: string; corps: string } | null>(null);
	const [iaEnCours, setIaEnCours] = useState(false);
	const [iaErreur, setIaErreur] = useState('');
	const enLigne = navigator.onLine && statut.connected;

	async function lancerRedaction(e: FormEvent) {
		e.preventDefault();
		setIaEnCours(true);
		setIaErreur('');
		try {
			const b = await rediger({
				type: ia.type,
				copropriete_id: id,
				source_type: ia.source ? 'demande' : undefined,
				source_id: ia.source || undefined,
				destinataire: ia.destinataire || undefined,
				consignes: ia.consignes || undefined
			});
			setBrouillon({ objet: b.objet, corps: b.corps });
		} catch (err) {
			setIaErreur((err as Error).message);
		} finally {
			setIaEnCours(false);
		}
	}

	async function enregistrerBrouillon() {
		if (!brouillon) return;
		await creer('courrier', {
			copropriete_id: id,
			type: ia.type,
			destinataire: ia.destinataire || '—',
			objet: brouillon.objet,
			corps: brouillon.corps,
			statut: 'brouillon',
			source_type: ia.source ? 'demande' : null,
			source_id: ia.source || null
		});
		setBrouillon(null);
		setIa({ ...ia, consignes: '' });
	}

	const c = copros[0];
	if (!c) return isLoading ? null : <p className="vide">Copropriété introuvable. <Link to="/">Retour</Link></p>;

	return (
		<>
			<Link className="retour" to="/">
				← Copropriétés
			</Link>
			<h1>{c.nom}</h1>
			<p className="secondaire">{[c.adresse, c.code_postal, c.ville].filter(Boolean).join(' ')}</p>

			<section>
				<div className="entete">
					<h2>Demandes</h2>
					<button onClick={() => setFormDemande(!formDemande)}>{formDemande ? 'Annuler' : '+ Demande'}</button>
				</div>

				{formDemande && (
					<form className="carte formulaire" onSubmit={creerDemande}>
						<label>
							Titre
							<input value={d.titre} onChange={(e) => setD({ ...d, titre: e.target.value })} required placeholder="Fuite plafond salle de bain, 3e étage" />
						</label>
						<div className="ligne">
							<label>
								Catégorie
								<select value={d.categorie} onChange={(e) => setD({ ...d, categorie: e.target.value })}>
									{options(CATEGORIES_DEMANDE)}
								</select>
							</label>
							<label>
								Priorité
								<select value={d.priorite} onChange={(e) => setD({ ...d, priorite: e.target.value })}>
									{options(PRIORITES)}
								</select>
							</label>
						</div>
						<label>
							Description
							<textarea value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} rows={4} />
						</label>
						<button type="submit">Enregistrer</button>
					</form>
				)}

				{demandes.length === 0 ? (
					<p className="vide">Aucune demande.</p>
				) : (
					<ul className="liste">
						{demandes.map((x) => (
							<li key={x.id} className="demande">
								<div>
									<strong>{x.titre}</strong>
									<span className="secondaire">
										{CATEGORIES_DEMANDE[x.categorie] ?? ''} · {dateCourte(x.created)}
									</span>
									<BadgeLocal id={x.id} enAttente={enAttente} />
								</div>
								<span className={`priorite p-${x.priorite}`}>{PRIORITES[x.priorite] ?? ''}</span>
								<select value={x.statut} onChange={(e) => modifier('demande', x.id, { statut: e.target.value })} aria-label="Statut">
									{options(STATUTS_DEMANDE)}
								</select>
							</li>
						))}
					</ul>
				)}
			</section>

			<section>
				<h2>Rédiger un courrier</h2>
				<form className="carte formulaire" onSubmit={lancerRedaction}>
					<div className="ligne">
						<label>
							Type
							<select value={ia.type} onChange={(e) => setIa({ ...ia, type: e.target.value as TypeCourrier })}>
								{options(TYPES_COURRIER)}
							</select>
						</label>
						<label>
							À propos de
							<select value={ia.source} onChange={(e) => setIa({ ...ia, source: e.target.value })}>
								<option value="">— Aucune demande —</option>
								{demandes.map((x) => (
									<option key={x.id} value={x.id}>
										{x.titre}
									</option>
								))}
							</select>
						</label>
					</div>
					<label>
						Destinataire
						<input value={ia.destinataire} onChange={(e) => setIa({ ...ia, destinataire: e.target.value })} placeholder="Mme Marie Dupont" />
					</label>
					<label>
						Consignes
						<textarea value={ia.consignes} onChange={(e) => setIa({ ...ia, consignes: e.target.value })} rows={2} placeholder="Rappeler le passage du plombier prévu jeudi" />
					</label>
					{ia.source && enAttente.has(ia.source) && <p className="aide">Cette demande n'est pas encore synchronisée : l'IA ne la verra qu'après envoi.</p>}
					{iaErreur && <p className="erreur">{iaErreur}</p>}
					<button type="submit" disabled={iaEnCours || !enLigne}>
						{iaEnCours ? 'Rédaction…' : enLigne ? 'Rédiger avec l’IA' : 'Rédaction IA indisponible hors ligne'}
					</button>
				</form>

				{brouillon && (
					<div className="carte formulaire brouillon">
						<label>
							Objet
							<input value={brouillon.objet} onChange={(e) => setBrouillon({ ...brouillon, objet: e.target.value })} />
						</label>
						<label>
							Corps
							<textarea value={brouillon.corps} onChange={(e) => setBrouillon({ ...brouillon, corps: e.target.value })} rows={16} />
						</label>
						<div className="ligne">
							<button onClick={enregistrerBrouillon}>Enregistrer le brouillon</button>
							<button className="secondaire-btn" onClick={() => setBrouillon(null)}>
								Abandonner
							</button>
						</div>
					</div>
				)}

				{courriers.length > 0 && (
					<>
						<h3>Courriers</h3>
						<ul className="liste">
							{courriers.map((co) => (
								<li key={co.id}>
									<strong>{co.objet || TYPES_COURRIER[co.type]}</strong>
									<span className="secondaire">
										{co.destinataire} · {co.statut} · {dateCourte(co.updated)}
									</span>
									<BadgeLocal id={co.id} enAttente={enAttente} />
								</li>
							))}
						</ul>
					</>
				)}
			</section>
		</>
	);
}
