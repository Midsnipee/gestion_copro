import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { estTable, TABLES, type NomTable, type TypeColonne } from '@copro/shared/tables';
import type { Pool } from './db.ts';

/** Écriture envoyée par un appareil (format CrudEntry de PowerSync). */
export interface Operation {
	op: 'PUT' | 'PATCH' | 'DELETE';
	table: string;
	id: string;
	opData?: Record<string, unknown>;
	previousValues?: Record<string, unknown>;
}

export interface Bilan {
	appliquees: number;
	conflits: number;
	rejets: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Erreur passagère (base indisponible…) : l'appareil doit réessayer plus tard. */
export class ErreurPassagere extends Error {}

class Rejet extends Error {}

/** Convertit une valeur venant de SQLite (appareil) vers le type Postgres attendu. */
function convertir(type: TypeColonne, v: unknown): unknown {
	if (v === undefined || v === null || v === '') return null;
	switch (type) {
		case 'bool':
			return typeof v === 'boolean' ? v : Number(v) !== 0;
		case 'integer':
		case 'real': {
			const n = Number(v);
			if (!Number.isFinite(n)) throw new Rejet(`nombre invalide : ${v}`);
			return type === 'integer' ? Math.trunc(n) : n;
		}
		case 'json':
			if (typeof v !== 'string') return JSON.stringify(v);
			try {
				JSON.parse(v);
				return v;
			} catch {
				throw new Rejet('JSON invalide');
			}
		case 'uuid':
			if (!UUID.test(String(v))) throw new Rejet(`identifiant invalide : ${v}`);
			return String(v);
		default:
			return String(v);
	}
}

/** Ne garde que les colonnes connues de la table ; ignore les colonnes gérées par le serveur. */
function colonnes(table: NomTable, data: Record<string, unknown> = {}) {
	const def = TABLES[table] as Record<string, TypeColonne>;
	const noms: string[] = [];
	const valeurs: unknown[] = [];
	for (const [k, v] of Object.entries(data)) {
		if (!Object.hasOwn(def, k)) continue;
		noms.push(k);
		valeurs.push(convertir(def[k], v));
	}
	return { noms, valeurs };
}

const q = (nom: string) => `"${nom}"`; // noms issus de la liste blanche uniquement

async function appliquer(c: PoolClient, o: Operation, t: NomTable): Promise<'ok' | { serveur: unknown }> {
	if (o.op === 'DELETE') {
		await c.query(`DELETE FROM ${q(t)} WHERE id = $1`, [o.id]);
		return 'ok';
	}

	const { noms, valeurs } = colonnes(t, o.opData);

	if (o.op === 'PUT') {
		// Création. Si la ligne existe déjà (renvoi après coupure), on la met à jour.
		const cols = ['id', ...noms];
		const params = cols.map((_, i) => `$${i + 1}`);
		const maj = noms.length ? noms.map((n) => `${q(n)} = EXCLUDED.${q(n)}`).join(', ') + ', ' : '';
		await c.query(
			`INSERT INTO ${q(t)} (${cols.map(q).join(', ')}) VALUES (${params.join(', ')})
			 ON CONFLICT (id) DO UPDATE SET ${maj}version = ${q(t)}.version + 1`,
			[o.id, ...valeurs]
		);
		return 'ok';
	}

	// PATCH : contrôle de version. L'appareil transmet la version sur laquelle il a travaillé.
	const { rows } = await c.query(`SELECT * FROM ${q(t)} WHERE id = $1 FOR UPDATE`, [o.id]);
	const actuel = rows[0];
	if (!actuel) throw new Rejet('fiche supprimée entre-temps sur le serveur');
	const base = o.previousValues?.version;
	if (base !== undefined && base !== null && Number(base) !== actuel.version) {
		return { serveur: actuel };
	}
	if (!noms.length) return 'ok';
	await c.query(
		`UPDATE ${q(t)} SET ${noms.map((n, i) => `${q(n)} = $${i + 2}`).join(', ')}, version = version + 1 WHERE id = $1`,
		[o.id, ...valeurs]
	);
	return 'ok';
}

async function noterConflit(
	c: PoolClient,
	o: Operation,
	nature: 'concurrence' | 'rejet',
	auteur: string,
	serveur: unknown,
	message: string
) {
	await c.query(
		`INSERT INTO conflit (id, nature, table_cible, ligne_id, operation, donnees_appareil, donnees_serveur, message, auteur_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		[
			randomUUID(),
			nature,
			o.table,
			UUID.test(o.id) ? o.id : '00000000-0000-0000-0000-000000000000',
			o.op,
			JSON.stringify(o.opData ?? null),
			JSON.stringify(serveur ?? null),
			message.slice(0, 500),
			auteur
		]
	);
}

// Codes Postgres d'une donnée refusée (et non d'une panne) : 22xxx données, 23xxx contraintes
const estRefusDonnees = (e: unknown) => /^2[23]/.test(String((e as { code?: string }).code ?? ''));

/**
 * Applique un lot d'écritures dans une transaction. Une écriture refusée ou en conflit
 * ne bloque jamais la file de l'appareil : elle est consignée dans `conflit`
 * (synchronisée vers les appareils) et l'utilisatrice tranche.
 */
export async function traiterLot(pool: Pool, operations: Operation[], auteur: string): Promise<Bilan> {
	const bilan: Bilan = { appliquees: 0, conflits: 0, rejets: 0 };
	let c: PoolClient;
	try {
		c = await pool.connect();
	} catch (e) {
		throw new ErreurPassagere((e as Error).message);
	}
	try {
		await c.query('BEGIN');
		for (const o of operations) {
			await c.query('SAVEPOINT op');
			try {
				if (!estTable(o.table)) throw new Rejet(`table inconnue : ${o.table}`);
				if (!UUID.test(o.id)) throw new Rejet(`identifiant invalide : ${o.id}`);
				const r = await appliquer(c, o, o.table);
				if (r === 'ok') {
					bilan.appliquees++;
				} else {
					await c.query('ROLLBACK TO SAVEPOINT op');
					await noterConflit(c, o, 'concurrence', auteur, r.serveur, 'Fiche modifiée entre-temps sur un autre appareil');
					bilan.conflits++;
				}
			} catch (e) {
				if (!(e instanceof Rejet) && !estRefusDonnees(e)) throw e;
				await c.query('ROLLBACK TO SAVEPOINT op');
				await noterConflit(c, o, 'rejet', auteur, null, (e as Error).message);
				bilan.rejets++;
			}
			await c.query('RELEASE SAVEPOINT op');
		}
		await c.query('COMMIT');
		return bilan;
	} catch (e) {
		await c.query('ROLLBACK').catch(() => {});
		throw new ErreurPassagere((e as Error).message);
	} finally {
		c.release();
	}
}
