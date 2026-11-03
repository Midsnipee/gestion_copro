import { liveQuery } from 'dexie';

/** Résultat réactif d'une requête Dexie : se met à jour quand la base locale change
 * ou quand les dépendances (lues dans `deps`) changent. */
export function live<D, T>(deps: () => D, requete: (d: D) => Promise<T>, initial: T) {
	const etat = $state({ valeur: initial, pret: false });
	$effect(() => {
		const d = deps();
		const sub = liveQuery(() => requete(d)).subscribe({
			next: (v) => {
				etat.valeur = v;
				etat.pret = true;
			},
			error: (e) => console.error(e)
		});
		return () => sub.unsubscribe();
	});
	return etat;
}
