import { PowerSyncContext, useQuery } from '@powersync/react';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router';
import { EtatSync } from './components/EtatSync';
import { connecteur, db } from './lib/db';
import { ecrireSession, lireSession, surSession, type Session } from './lib/session';
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
			</nav>
			<EtatSync />
			<button className="lien" onClick={deconnexion} title={session.utilisateur.email}>
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
		if (ouverte) db.connect(connecteur);
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
