import { useEffect, useState, type FormEvent } from 'react';
import { connexion, initialiser } from '../lib/session';

export function Connexion() {
	const [premierLancement, setPremierLancement] = useState(false);

	useEffect(() => {
		fetch('/api/auth/initialisation')
			.then((r) => r.json())
			.then((d) => setPremierLancement(!!d.requise))
			.catch(() => {});
	}, []);

	return <main>{premierLancement ? <Initialisation /> : <FormulaireConnexion />}</main>;
}

function FormulaireConnexion() {
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
	);
}

/** Premier lancement : aucun compte n'existe encore sur le serveur. */
function Initialisation() {
	const [f, setF] = useState({ code: '', nom: '', email: '', mot_de_passe: '', confirmation: '' });
	const [erreur, setErreur] = useState('');
	const [enCours, setEnCours] = useState(false);
	const maj = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

	async function soumettre(e: FormEvent) {
		e.preventDefault();
		setErreur('');
		if (f.mot_de_passe.length < 12) return setErreur('Le mot de passe doit faire au moins 12 caractères.');
		if (f.mot_de_passe !== f.confirmation) return setErreur('Les deux mots de passe ne correspondent pas.');
		setEnCours(true);
		try {
			await initialiser({ code: f.code, nom: f.nom, email: f.email, mot_de_passe: f.mot_de_passe });
		} catch (err) {
			setErreur((err as Error).message);
		} finally {
			setEnCours(false);
		}
	}

	return (
		<section className="connexion">
			<h1>Premier lancement</h1>
			<p className="secondaire">Créez le compte administrateur. Les autres comptes se créent ensuite depuis l'écran Administration.</p>
			<form onSubmit={soumettre}>
				<label>
					Code d'initialisation
					<input value={f.code} onChange={maj('code')} required inputMode="numeric" autoComplete="one-time-code" placeholder="6 chiffres" />
				</label>
				<p className="aide">
					Le code s'affiche dans les journaux du serveur : <code>docker compose logs api | grep initialisation</code>
				</p>
				<label>
					Nom
					<input value={f.nom} onChange={maj('nom')} required autoComplete="name" />
				</label>
				<label>
					E-mail
					<input type="email" value={f.email} onChange={maj('email')} required autoComplete="username" />
				</label>
				<label>
					Mot de passe (12 caractères minimum)
					<input type="password" value={f.mot_de_passe} onChange={maj('mot_de_passe')} required autoComplete="new-password" />
				</label>
				<label>
					Confirmation
					<input type="password" value={f.confirmation} onChange={maj('confirmation')} required autoComplete="new-password" />
				</label>
				{erreur && <p className="erreur">{erreur}</p>}
				<button type="submit" disabled={enCours}>
					{enCours ? 'Création…' : "Créer l'administrateur"}
				</button>
			</form>
		</section>
	);
}
