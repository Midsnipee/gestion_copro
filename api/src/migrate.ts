import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from './db.ts';

/** Applique dans l'ordre les fichiers migrations/*.sql non encore appliqués. */
export async function migrer(pool: Pool, dossier: string, log = console.log) {
	const client = await pool.connect();
	try {
		await client.query('SELECT pg_advisory_lock(424242)');
		await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
			nom text PRIMARY KEY, applique timestamptz NOT NULL DEFAULT now())`);
		const faites = new Set((await client.query('SELECT nom FROM schema_migrations')).rows.map((r) => r.nom));
		for (const nom of readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort()) {
			if (faites.has(nom)) continue;
			await client.query('BEGIN');
			try {
				await client.query(readFileSync(join(dossier, nom), 'utf8'));
				await client.query('INSERT INTO schema_migrations (nom) VALUES ($1)', [nom]);
				await client.query('COMMIT');
				log(`migration appliquée : ${nom}`);
			} catch (e) {
				await client.query('ROLLBACK');
				throw new Error(`migration ${nom} : ${(e as Error).message}`);
			}
		}
	} finally {
		await client.query('SELECT pg_advisory_unlock(424242)').catch(() => {});
		client.release();
	}
}
