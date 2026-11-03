import { PowerSyncDatabase } from '@powersync/web';
import { Connecteur } from './connector';
import { AppSchema } from './schema';

export const db = new PowerSyncDatabase({
	schema: AppSchema,
	database: {
		dbFilename: 'gestion-copro.db',
		enableMultiTabs: typeof SharedWorker !== 'undefined'
	}
});

export const connecteur = new Connecteur();

export const nouvelId = () => crypto.randomUUID();
export const maintenant = () => new Date().toISOString();

/** Création locale : immédiate, envoyée au serveur dès que possible. */
export async function creer(table: string, valeurs: Record<string, unknown>) {
	const id = nouvelId();
	const cols = ['id', 'version', 'created', 'updated', ...Object.keys(valeurs)];
	await db.execute(
		`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
		[id, 1, maintenant(), maintenant(), ...Object.values(valeurs)]
	);
	return id;
}

/** Modification locale. La version d'origine est transmise automatiquement (trackPrevious). */
export async function modifier(table: string, id: string, valeurs: Record<string, unknown>) {
	const cols = Object.keys(valeurs);
	await db.execute(
		`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated = ? WHERE id = ?`,
		[...Object.values(valeurs), maintenant(), id]
	);
}

export async function supprimer(table: string, id: string) {
	await db.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
}
