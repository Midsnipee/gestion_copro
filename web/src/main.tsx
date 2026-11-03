import { PowerSyncContext, useQuery } from '@powersync/react';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router';
import { EtatSync } from './components/EtatSync';
import { connecteur, db } from './lib/db';
import { ecrireSession, lireSession, surSession, type Session } from './lib/session';
import { Admin } from './pages/admin/Admin';
import { Compte } from './pages/Compte';
import { Conflits } from './pages/Conflits';
import { Connexion } from './pages/Connexion';
import { Copro } from './pages/Copro';
import { Copros } from './pages/Copros';
import './app.css';

function Entete({ session }: { session: Session }) {
	const { data } = useQuery<{ n: number }>('SELECT count(*) AS n FROM conflit');
	const nbConflits = data[0]?.n ?? 0;

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
		<header>
			<NavLink className="marque" to="/">
				Gestion copro
			</NavLink>
			<nav>
				<NavLink to="/" end>
					Copropriétés
				</NavLink>
				<NavLink to="/conflits">
					Conflits{nbConflits > 0 && <span className="badge alerte">{nbConflits}</span>}
				</NavLink>
				{session.utilisateur.role === 'admin' && <NavLink to="/admin">Administration</NavLink>}
			</nav>
			<EtatSync />
			<NavLink className="lien" to="/compte" title={session.utilisateur.email}>
				{session.utilisateur.nom}
			</NavLink>
			<button className="lien" onClick={deconnexion}>
				Déconnexion
			</button>
		</header>
	);
}

function App() {
	const [session, setSession] = useState<Session | null>(lireSession());
	useEffect(() => {
		const stop = surSession(setSession);
		return () => void stop();
	}, []);

	// Connecté = une session existe sur l'appareil, même hors ligne
	const ouverte = session !== null;
	useEffect(() => {
		if (ouverte) {
			db.connect(connecteur);
			return;
		}
		// Session fermée par le serveur (compte désactivé, mot de passe réinitialisé) :
		// les données de l'appareil sont effacées
		void db.disconnectAndClear();
	}, [ouverte]);

	if (!session) return <Connexion />;
	return (
		<>
			<Entete session={session} />
			<main>
				<Routes>
					<Route path="/" element={<Copros />} />
					<Route path="/copro/:id" element={<Copro />} />
					<Route path="/conflits" element={<Conflits />} />
					<Route path="/compte" element={<Compte />} />
					{session.utilisateur.role === 'admin' && <Route path="/admin/*" element={<Admin />} />}
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</main>
		</>
	);
}

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<PowerSyncContext.Provider value={db}>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</PowerSyncContext.Provider>
	</StrictMode>
);
