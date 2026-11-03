import Dexie, { type EntityTable } from 'dexie';

// Copie locale (hors ligne) des collections utiles sur le terrain.
// Les fichiers (scans, photos) ne sont pas copiés par défaut.
export const COLLECTIONS_SYNC = [
	'copropriete',
	'lot',
	'personne',
	'entreprise',
	'contrat',
	'demande',
	'reunion',
	'chantier',
	'courrier',
	'visite',
	'tache'
] as const;
export type CollectionSync = (typeof COLLECTIONS_SYNC)[number];

export interface Enregistrement {
	id: string;
	updated?: string;
	created?: string;
	copropriete?: string;
	[champ: string]: unknown;
}

export interface Operation {
	seq?: number;
	collection: CollectionSync;
	op: 'create' | 'update' | 'delete';
	id: string;
	data?: Record<string, unknown>;
	tentatives: number;
	erreur?: string;
	cree_le: string;
}

export interface Meta {
	cle: string;
	valeur: string;
}

type Tables = { [K in CollectionSync]: EntityTable<Enregistrement, 'id'> } & {
	outbox: EntityTable<Operation, 'seq'>;
	meta: EntityTable<Meta, 'cle'>;
};

export const db = new Dexie('gestion-copro') as Dexie & Tables;

db.version(1).stores({
	...Object.fromEntries(COLLECTIONS_SYNC.map((c) => [c, 'id, copropriete, updated'])),
	outbox: '++seq, collection, id',
	meta: 'cle'
});

/** Identifiant au format PocketBase (15 caractères [a-z0-9]), généré côté client
 * pour que les fiches créées hors ligne gardent leur id une fois synchronisées. */
export function nouvelId(): string {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
	const octets = crypto.getRandomValues(new Uint8Array(15));
	return Array.from(octets, (o) => alphabet[o % alphabet.length]).join('');
}
