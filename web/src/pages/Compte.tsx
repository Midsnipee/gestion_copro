import { useState, type FormEvent } from 'react';
import { api, lireSession } from '../lib/session';

export function Compte() {
	const s = lireSession()!;
	const [f, setF] = useState({ actuel: '', nouveau: '', confirmation: '' });
	const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

	async function soumettre(e: FormEvent) {
		e.preventDefault();
		setMessage(null);
		if (f.nouveau.length < 12) return setMessage({ ok: false, texte: 'Le nouveau mot de passe doit faire au moins 12 caractères.' });
		if (f.nouveau !== f.confirmation) return setMessage({ ok: false, texte: 'Les deux mots de passe ne correspondent pas.' });
		try {
			await api('/api/compte/mot-de-passe', { actuel: f.actuel, nouveau: f.nouveau, renouvellement: lireSession()?.renouvellement });
			setF({ actuel: '', nouveau: '', confirmation: '' });
			setMessage({ ok: true, texte: 'Mot de passe changé. Vos autres appareils devront se reconnecter.' });
		} catch (err) {
			setMessage({ ok: false, texte: navigator.onLine ? (err as Error).message : 'Changement impossible hors ligne.' });
		}
	}

	return (
		<>
			<h1>Mon compte</h1>
			<p className="secondaire">
				{s.utilisateur.nom} · {s.utilisateur.email} · {s.utilisateur.role === 'admin' ? 'Administrateur' : 'Gestionnaire'}
			</p>
			<h2>Changer de mot de passe</h2>
			<form className="carte formulaire" onSubmit={soumettre}>
				<label>
					Mot de passe actuel
					<input type="password" value={f.actuel} onChange={(e) => setF({ ...f, actuel: e.target.value })} required autoComplete="current-password" />
				</label>
				<label>
					Nouveau mot de passe (12 caractères minimum)
					<input type="password" value={f.nouveau} onChange={(e) => setF({ ...f, nouveau: e.target.value })} required autoComplete="new-password" />
				</label>
				<label>
					Confirmation
					<input type="password" value={f.confirmation} onChange={(e) => setF({ ...f, confirmation: e.target.value })} required autoComplete="new-password" />
				</label>
				{message && <p className={message.ok ? 'aide' : 'erreur'}>{message.texte}</p>}
				<button type="submit">Changer le mot de passe</button>
			</form>
		</>
	);
}
