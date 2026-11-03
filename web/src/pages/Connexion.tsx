import { useState, type FormEvent } from 'react';
import { connexion } from '../lib/session';

export function Connexion() {
	const [email, setEmail] = useState('');
	const [motDePasse, setMotDePasse] = useState('');
	const [erreur, setErreur] = useState('');
	const [enCours, setEnCours] = useState(false);

	async function soumettre(e: FormEvent) {
		e.preventDefault();
		setErreur('');
		setEnCours(true);
		try {
			await connexion(email, motDePasse);
		} catch (err) {
			setErreur(navigator.onLine ? (err as Error).message : 'Connexion impossible hors ligne.');
		} finally {
			setEnCours(false);
		}
	}

	return (
		<main>
			<section className="connexion">
				<h1>Gestion copro</h1>
				<form onSubmit={soumettre}>
					<label>
						E-mail
						<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
					</label>
					<label>
						Mot de passe
						<input type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required autoComplete="current-password" />
					</label>
					{erreur && <p className="erreur">{erreur}</p>}
					<button type="submit" disabled={enCours}>
						{enCours ? 'Connexion…' : 'Se connecter'}
					</button>
				</form>
				<p className="aide">Une fois connectée, l'application reste utilisable hors ligne sur cet appareil.</p>
			</section>
		</main>
	);
}
