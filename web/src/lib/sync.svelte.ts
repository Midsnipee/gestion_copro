import { ClientResponseError } from 'pocketbase';
import { COLLECTIONS_SYNC, db, nouvelId, type CollectionSync, type Enregistrement } from './db';
import { pb } from './pb';

export const etat = $state({
	enLigne: typeof navigator === 'undefined' ? true : navigator.onLine,
	enCours: false,
	enAttente: 0,
	derniereSync: '' as string,
	erreur: '' as string
});

/** Toute écriture passe par ici : appliquée en local tout de suite,
 * puis mise dans la file d'envoi (outbox). */
export async function ecrire(
	collection: CollectionSync,
	op: 'create' | 'update' | 'delete',
	data: Record<string, unknown> & { id?: string }
): Promise<string> {
	const id = data.id ?? nouvelId();
	const maintenant = new Date().toISOString();
	await db.transaction('rw', db[collection], db.outbox, async () => {
		if (op === 'delete') {
			await db[collection].delete(id);
		} else {
			const avant = (await db[collection].get(id)) ?? {};
			await db[collection].put({ ...avant, ...data, id, updated: maintenant } as Enregistrement);
		}
		await db.outbox.add({ collection, op, id, data: op === 'delete' ? undefined : { ...data, id }, tentatives: 0, cree_le: maintenant });
	});
	await rafraichirCompteur();
	void synchroniser();
	return id;
}

async function rafraichirCompteur() {
	etat.enAttente = await db.outbox.count();
}

/** Envoie la file d'attente, dans l'ordre. S'arrête à la première panne réseau. */
async function pousser() {
	const ops = await db.outbox.orderBy('seq').toArray();
	for (const o of ops) {
		try {
			const col = pb.collection(o.collection);
			if (o.op === 'create') {
				try {
					await col.create(o.data!);
				} catch (e) {
					// Déjà créé lors d'un envoi précédent interrompu : on bascule en mise à jour
					if (e instanceof ClientResponseError && e.status === 400 && e.response?.data?.id) {
						await col.update(o.id, o.data!);
					} else throw e;
				}
			} else if (o.op === 'update') {
				await col.update(o.id, o.data!);
			} else {
				await col.delete(o.id).catch((e) => {
					if (!(e instanceof ClientResponseError && e.status === 404)) throw e;
				});
			}
			await db.outbox.delete(o.seq!);
		} catch (e) {
			if (e instanceof ClientResponseError && e.status === 0) throw e; // hors ligne
			// Refus serveur (validation…) : on garde l'opération avec l'erreur, sans bloquer les suivantes
			await db.outbox.update(o.seq!, { tentatives: o.tentatives + 1, erreur: String((e as Error).message) });
		}
	}
}

/** Récupère les fiches modifiées depuis la dernière synchronisation. */
async function tirer() {
	for (const c of COLLECTIONS_SYNC) {
		const cle = `sync:${c}`;
		const depuis = (await db.meta.get(cle))?.valeur ?? '';
		const filtre = depuis ? pb.filter('updated > {:d}', { d: depuis }) : '';
		const items = await pb.collection(c).getFullList<Enregistrement>({ filter: filtre, sort: 'updated', batch: 500 });
		if (!items.length) continue;
		// Une fiche encore en attente d'envoi n'est pas écrasée par la version serveur
		const enAttente = new Set((await db.outbox.where('collection').equals(c).toArray()).map((o) => o.id));
		await db[c].bulkPut(items.filter((i) => !enAttente.has(i.id)));
		await db.meta.put({ cle, valeur: items[items.length - 1].updated! });
	}
}

let promesse: Promise<void> | null = null;

export function synchroniser(): Promise<void> {
	if (!pb.authStore.isValid || !etat.enLigne) return Promise.resolve();
	promesse ??= (async () => {
		etat.enCours = true;
		etat.erreur = '';
		try {
			await pousser();
			await tirer();
			etat.derniereSync = new Date().toISOString();
		} catch (e) {
			etat.erreur = (e as Error).message;
		} finally {
			etat.enCours = false;
			await rafraichirCompteur();
			promesse = null;
		}
	})();
	return promesse;
}

export function demarrerSynchro() {
	const maj = () => {
		etat.enLigne = navigator.onLine;
		if (etat.enLigne) void synchroniser();
	};
	window.addEventListener('online', maj);
	window.addEventListener('offline', maj);
	const minuterie = setInterval(() => void synchroniser(), 60_000);
	void rafraichirCompteur();
	void synchroniser();
	return () => {
		window.removeEventListener('online', maj);
		window.removeEventListener('offline', maj);
		clearInterval(minuterie);
	};
}

export async function viderDonneesLocales() {
	await db.delete();
	await db.open();
}
