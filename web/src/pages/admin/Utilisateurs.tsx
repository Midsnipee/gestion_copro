import { useState, type FormEvent } from 'react';
import { api, lireSession } from '../../lib/session';
import { dateHeure, motDePasseAleatoire, useRessource } from './commun';

type Role = 'admin' | 'gestionnaire';
interface Compte {
	id: string;
	email: string;
	nom: string;
	role: Role;
	actif: boolean;
	created: string;
	derniere_connexion: string | null;
	sessions: { appareil: string | null; depuis: string }[];
}

const ROLES: Record<Role, string> = { admin: 'Administrateur', gestionnaire: 'Gestionnaire' };

export function Utilisateurs() {
	const { donnees: comptes, erreur, recharger } = useRessource<Compte[]>('/api/admin/utilisateurs');
	const [ajout, setAjout] = useState(false);
	const [edition, setEdition] = useState<string | null>(null);
	const [message, setMessage] = useState<{ texte: string; mdp?: string } | null>(null);
	const [erreurAction, setErreurAction] = useState('');
	const moi = lireSession()?.utilisateur.id;

	async function action(fn: () => Promise<unknown>, succes?: string) {
		setErreurAction('');
		try {
			await fn();
			if (succes) setMessage({ texte: succes });
			await recharger();
		} catch (e) {
			setErreurAction((e as Error).message);
		}
	}

	async function reinitialiser(c: Compte) {
		if (!confirm(`Réinitialiser le mot de passe de ${c.nom} ? Ses appareils seront déconnectés.`)) return;
		const mdp = motDePasseAleatoire();
		await action(() => api(`/api/admin/utilisateurs/${c.id}/mot-de-passe`, { mot_de_passe: mdp }));
		setMessage({ texte: `Nouveau mot de passe de ${c.nom} (à lui transmettre, il ne sera plus affiché) :`, mdp });
	}

	return (
		<>
			<div className="entete">
				<h2>Utilisateurs</h2>
				<button onClick={() => setAjout(!ajout)}>{ajout ? 'Annuler' : '+ Utilisateur'}</button>
			</div>

			{message && (
				<div className="carte info">
					<p>{message.texte}</p>
					{message.mdp && <code className="secret">{message.mdp}</code>}
					<button className="secondaire-btn" onClick={() => setMessage(null)}>
						OK
					</button>
				</div>
			)}
			{erreurAction && <p className="erreur">{erreurAction}</p>}

			{ajout && (
				<NouvelUtilisateur
					onCree={async (nom, mdp) => {
						setAjout(false);
						setMessage({ texte: `Compte de ${nom} créé. Mot de passe à lui transmettre (il ne sera plus affiché) :`, mdp });
						await recharger();
					}}
				/>
			)}

			{erreur && <p className="erreur">{erreur}</p>}
			{comptes && (
				<ul className="liste comptes">
					{comptes.map((c) => (
						<li key={c.id} className={c.actif ? '' : 'inactif'}>
							{edition === c.id ? (
								<EditionCompte
									compte={c}
									onFini={async (modifs) => {
										if (modifs) await action(() => api(`/api/admin/utilisateurs/${c.id}`, modifs, 'PATCH'), 'Compte modifié.');
										setEdition(null);
									}}
								/>
							) : (
								<>
									<div className="ligne-compte">
										<div>
											<span className="titre-compte">
												<strong>{c.nom}</strong>
												<span className={`badge ${c.role === 'admin' ? 'role-admin' : ''}`}>{ROLES[c.role]}</span>
												{c.id === moi && <span className="badge">vous</span>}
												{!c.actif && <span className="badge local">Désactivé</span>}
											</span>
											<span className="secondaire">{c.email}</span>
											<span className="secondaire">
												Dernière connexion : {dateHeure(c.derniere_connexion)} · {c.sessions.length} appareil(s) connecté(s)
											</span>
										</div>
										<div className="actions">
											<button className="secondaire-btn" onClick={() => setEdition(c.id)}>
												Modifier
											</button>
											<button className="secondaire-btn" onClick={() => reinitialiser(c)}>
												Nouveau mot de passe
											</button>
											{c.sessions.length > 0 && (
												<button
													className="secondaire-btn"
													onClick={() =>
														confirm(`Déconnecter les ${c.sessions.length} appareil(s) de ${c.nom} ?`) &&
														action(() => api(`/api/admin/utilisateurs/${c.id}/deconnecter`, {}), 'Appareils déconnectés.')
													}
												>
													Déconnecter les appareils
												</button>
											)}
											{c.actif ? (
												<button
													className="danger-btn"
													onClick={() =>
														confirm(`Désactiver le compte de ${c.nom} ? Il ne pourra plus se connecter.`) &&
														action(() => api(`/api/admin/utilisateurs/${c.id}`, { actif: false }, 'PATCH'), 'Compte désactivé.')
													}
												>
													Désactiver
												</button>
											) : (
												<button className="secondaire-btn" onClick={() => action(() => api(`/api/admin/utilisateurs/${c.id}`, { actif: true }, 'PATCH'), 'Compte réactivé.')}>
													Réactiver
												</button>
											)}
										</div>
									</div>
									{c.sessions.length > 0 && (
										<details>
											<summary className="secondaire">Appareils</summary>
											<ul>
												{c.sessions.map((s, i) => (
													<li key={i} className="secondaire">
														{s.appareil || 'Appareil inconnu'} · connecté le {dateHeure(s.depuis)}
													</li>
												))}
											</ul>
										</details>
									)}
								</>
							)}
						</li>
					))}
				</ul>
			)}
		</>
	);
}

function NouvelUtilisateur({ onCree }: { onCree: (nom: string, mdp: string) => void }) {
	const [f, setF] = useState({ nom: '', email: '', role: 'gestionnaire' as Role, mot_de_passe: motDePasseAleatoire() });
	const [erreur, setErreur] = useState('');

	async function soumettre(e: FormEvent) {
		e.preventDefault();
		setErreur('');
		if (f.mot_de_passe.length < 12) return setErreur('Le mot de passe doit faire au moins 12 caractères.');
		try {
			await api('/api/admin/utilisateurs', f);
			onCree(f.nom, f.mot_de_passe);
		} catch (err) {
			setErreur((err as Error).message);
		}
	}

	return (
		<form className="carte formulaire" onSubmit={soumettre}>
			<div className="ligne">
				<label>
					Nom
					<input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} required placeholder="Marie Martin" />
				</label>
				<label>
					E-mail
					<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
				</label>
			</div>
			<div className="ligne">
				<label>
					Rôle
					<select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
						<option value="gestionnaire">Gestionnaire</option>
						<option value="admin">Administrateur</option>
					</select>
				</label>
				<label>
					Mot de passe provisoire
					<span className="champ-bouton">
						<input value={f.mot_de_passe} onChange={(e) => setF({ ...f, mot_de_passe: e.target.value })} required minLength={12} />
						<button type="button" className="secondaire-btn" onClick={() => setF({ ...f, mot_de_passe: motDePasseAleatoire() })}>
							Générer
						</button>
					</span>
				</label>
			</div>
			<p className="aide">La personne pourra le changer depuis « Mon compte ».</p>
			{erreur && <p className="erreur">{erreur}</p>}
			<button type="submit">Créer le compte</button>
		</form>
	);
}

function EditionCompte({ compte, onFini }: { compte: Compte; onFini: (modifs: Partial<Compte> | null) => void }) {
	const [f, setF] = useState({ nom: compte.nom, email: compte.email, role: compte.role });

	function soumettre(e: FormEvent) {
		e.preventDefault();
		const modifs = Object.fromEntries(Object.entries(f).filter(([k, v]) => compte[k as keyof Compte] !== v));
		onFini(Object.keys(modifs).length ? modifs : null);
	}

	return (
		<form className="formulaire" onSubmit={soumettre}>
			<div className="ligne">
				<label>
					Nom
					<input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} required />
				</label>
				<label>
					E-mail
					<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
				</label>
				<label>
					Rôle
					<select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
						<option value="gestionnaire">Gestionnaire</option>
						<option value="admin">Administrateur</option>
					</select>
				</label>
			</div>
			<div className="ligne">
				<button type="submit">Enregistrer</button>
				<button type="button" className="secondaire-btn" onClick={() => onFini(null)}>
					Annuler
				</button>
			</div>
		</form>
	);
}
