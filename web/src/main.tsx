import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import { PowerSyncContext } from '@powersync/react';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Coquille } from './components/Coquille';
import { connecteur, db } from './lib/db';
import { lireSession, surSession, type Session } from './lib/session';
import { Admin } from './pages/admin/Admin';
import { Compte } from './pages/Compte';
import { Conflits } from './pages/Conflits';
import { Connexion } from './pages/Connexion';
import { Copro } from './pages/Copro';
import { PageModule } from './pages/PageModule';
import { TableauDeBord } from './pages/TableauDeBord';
import './app.css';

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
		<Coquille session={session}>
			<Routes>
				<Route path="/" element={<TableauDeBord />} />
				<Route path="/m/:cle" element={<PageModule />} />
				<Route path="/copro/:id" element={<Copro />} />
				<Route path="/conflits" element={<Conflits />} />
				<Route path="/compte" element={<Compte />} />
				{session.utilisateur.role === 'admin' && <Route path="/admin/*" element={<Admin />} />}
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</Coquille>
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
