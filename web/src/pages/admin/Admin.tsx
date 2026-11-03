import { NavLink, Navigate, Route, Routes } from 'react-router';
import { EtatSysteme } from './Etat';
import { Journal } from './Journal';
import { ModelesIA } from './ModelesIA';
import { Utilisateurs } from './Utilisateurs';

export function Admin() {
	return (
		<>
			<h1>Administration</h1>
			{!navigator.onLine && <p className="erreur">L'administration nécessite une connexion au serveur.</p>}
			<nav className="onglets">
				<NavLink to="/admin/utilisateurs">Utilisateurs</NavLink>
				<NavLink to="/admin/etat">État du système</NavLink>
				<NavLink to="/admin/ia">Modèles IA</NavLink>
				<NavLink to="/admin/journal">Journal</NavLink>
			</nav>
			<Routes>
				<Route path="utilisateurs" element={<Utilisateurs />} />
				<Route path="etat" element={<EtatSysteme />} />
				<Route path="ia" element={<ModelesIA />} />
				<Route path="journal" element={<Journal />} />
				<Route path="*" element={<Navigate to="/admin/utilisateurs" replace />} />
			</Routes>
		</>
	);
}
