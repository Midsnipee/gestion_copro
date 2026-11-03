import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/session';

/** Chargement d'une ressource d'administration (en ligne uniquement). */
export function useRessource<T>(chemin: string) {
	const [donnees, setDonnees] = useState<T | null>(null);
	const [erreur, setErreur] = useState('');
	const [enCours, setEnCours] = useState(true);
	const recharger = useCallback(async () => {
		setEnCours(true);
		try {
			setDonnees(await api<T>(chemin));
			setErreur('');
		} catch (e) {
			setErreur(navigator.onLine ? (e as Error).message : 'Administration indisponible hors ligne.');
		} finally {
			setEnCours(false);
		}
	}, [chemin]);
	useEffect(() => {
		void recharger();
	}, [recharger]);
	return { donnees, erreur, enCours, recharger };
}

export const dateHeure = (d?: string | null) =>
	d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** Mot de passe aléatoire lisible (sans caractères ambigus). */
export function motDePasseAleatoire(longueur = 16) {
	const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
	return Array.from(crypto.getRandomValues(new Uint8Array(longueur)), (o) => alphabet[o % alphabet.length]).join('');
}
