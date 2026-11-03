import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { creerApp } from '../src/app.ts';
import { chargerCles } from '../src/cles.ts';
import { creerPool } from '../src/db.ts';
import { migrer } from '../src/migrate.ts';
import { hacher } from '../src/motdepasse.ts';

// Postgres de test : TEST_DATABASE_ADMIN_URL pointe sur une base d'administration ;
// une base jetable est créée par fichier de test.
const ADMIN = process.env.TEST_DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/postgres';

export async function preparer() {
	const nom = `copro_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
	const admin = new pg.Client({ connectionString: ADMIN });
	await admin.connect();
	await admin.query(`CREATE DATABASE ${nom}`);
	await admin.end();

	const url = new URL(ADMIN);
	url.pathname = `/${nom}`;
	const pool = creerPool(url.toString());
	await migrer(pool, join(import.meta.dirname, '..', 'migrations'), () => {});
	await pool.query(`INSERT INTO utilisateur (id, email, nom, mot_de_passe) VALUES
		('11111111-1111-4111-8111-111111111111', 'aline@test.fr', 'Aline', $1)`, [await hacher('motdepasse-solide')]);

	const cles = await chargerCles(mkdtempSync(join(tmpdir(), 'cles-')));
	const app = creerApp(pool, cles);

	const nettoyer = async () => {
		await app.close();
		await pool.end();
		const a = new pg.Client({ connectionString: ADMIN });
		await a.connect();
		await a.query(`DROP DATABASE IF EXISTS ${nom} WITH (FORCE)`);
		await a.end();
	};

	const connexion = async () => {
		const r = await app.inject({ method: 'POST', url: '/api/auth/connexion', payload: { email: 'aline@test.fr', mot_de_passe: 'motdepasse-solide' } });
		return r.json() as { acces: string; renouvellement: string };
	};

	return { app, pool, cles, nettoyer, connexion };
}
