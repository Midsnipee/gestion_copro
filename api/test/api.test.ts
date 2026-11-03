import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TABLES } from '@copro/shared/tables';
import { config } from '../src/config.ts';
import { preparer } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof preparer>>;
let jeton: string;

const COPRO = 'aaaaaaaa-0000-4000-8000-000000000001';
const DEMANDE = 'bbbbbbbb-0000-4000-8000-000000000001';

const envoyer = (operations: unknown[]) =>
	ctx.app.inject({
		method: 'POST',
		url: '/api/sync/upload',
		headers: { authorization: `Bearer ${jeton}` },
		payload: { operations }
	});

beforeAll(async () => {
	ctx = await preparer();
	jeton = (await ctx.connexion()).acces;
});
afterAll(() => ctx.nettoyer());

describe('schéma', () => {
	it('le SQL correspond à shared/src/tables.ts', async () => {
		const { rows } = await ctx.pool.query(
			`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
		);
		for (const [table, cols] of Object.entries(TABLES)) {
			const enBase = new Set(rows.filter((r) => r.table_name === table).map((r) => r.column_name));
			const attendu = new Set(['id', 'version', 'created', 'updated', ...Object.keys(cols)]);
			expect([...enBase].sort(), table).toEqual([...attendu].sort());
		}
	});

	it('toutes les tables synchronisées sont publiées pour PowerSync', async () => {
		const { rows } = await ctx.pool.query(`SELECT tablename FROM pg_publication_tables WHERE pubname = 'powersync'`);
		expect(rows.map((r) => r.tablename).sort()).toEqual(Object.keys(TABLES).sort());
	});
});

describe('authentification', () => {
	it('refuse un mauvais mot de passe', async () => {
		const r = await ctx.app.inject({ method: 'POST', url: '/api/auth/connexion', payload: { email: 'aline@test.fr', mot_de_passe: 'faux' } });
		expect(r.statusCode).toBe(401);
	});

	it('émet un jeton lisible par PowerSync (kid présent dans le JWKS, audience powersync)', async () => {
		const { acces } = await ctx.connexion();
		const [entete, charge] = acces.split('.').slice(0, 2).map((p) => JSON.parse(Buffer.from(p, 'base64url').toString()));
		const jwks = (await ctx.app.inject({ url: '/api/.well-known/jwks.json' })).json();
		expect(jwks.keys.map((k: { kid: string }) => k.kid)).toContain(entete.kid);
		expect(charge.aud).toContain('powersync');
		expect(charge.sub).toBe('11111111-1111-4111-8111-111111111111');
	});

	it('jeton de renouvellement à usage unique', async () => {
		const { renouvellement } = await ctx.connexion();
		const r1 = await ctx.app.inject({ method: 'POST', url: '/api/auth/renouveler', payload: { renouvellement } });
		expect(r1.statusCode).toBe(200);
		expect(r1.json().acces).toBeTruthy();
		const r2 = await ctx.app.inject({ method: 'POST', url: '/api/auth/renouveler', payload: { renouvellement } });
		expect(r2.statusCode).toBe(401);
	});

	it('protège l’envoi des écritures', async () => {
		const r = await ctx.app.inject({ method: 'POST', url: '/api/sync/upload', payload: { operations: [] } });
		expect(r.statusCode).toBe(401);
	});
});

describe('envoi des écritures', () => {
	it('crée, convertit les types et ignore les colonnes inconnues ou gérées par le serveur', async () => {
		const r = await envoyer([
			{ op: 'PUT', table: 'copropriete', id: COPRO, opData: { nom: 'Les Tilleuls', adresse: '12 rue des Lilas', alias: '["Tilleuls"]', nb_lots: '42', version: 99, pirate: 'x' } },
			{ op: 'PUT', table: 'demande', id: DEMANDE, opData: { copropriete_id: COPRO, titre: 'Fuite', statut: 'nouvelle', echeance: '2026-12-01' } }
		]);
		expect(r.json()).toEqual({ appliquees: 2, conflits: 0, rejets: 0 });
		const c = (await ctx.pool.query('SELECT * FROM copropriete WHERE id = $1', [COPRO])).rows[0];
		expect(c).toMatchObject({ nom: 'Les Tilleuls', alias: ['Tilleuls'], nb_lots: 42, version: 1 });
		const d = (await ctx.pool.query('SELECT echeance FROM demande WHERE id = $1', [DEMANDE])).rows[0];
		expect(d.echeance).toBe('2026-12-01');
	});

	it('un renvoi de la même création (coupure réseau) ne crée pas de doublon', async () => {
		const r = await envoyer([{ op: 'PUT', table: 'copropriete', id: COPRO, opData: { nom: 'Les Tilleuls', adresse: '12 rue des Lilas' } }]);
		expect(r.json().appliquees).toBe(1);
		expect((await ctx.pool.query('SELECT count(*)::int n FROM copropriete')).rows[0].n).toBe(1);
	});

	it('applique une modification faite sur la bonne version et incrémente la version', async () => {
		const v = (await ctx.pool.query('SELECT version FROM demande WHERE id = $1', [DEMANDE])).rows[0].version;
		const r = await envoyer([{ op: 'PATCH', table: 'demande', id: DEMANDE, opData: { statut: 'en_cours' }, previousValues: { version: v } }]);
		expect(r.json()).toEqual({ appliquees: 1, conflits: 0, rejets: 0 });
		const d = (await ctx.pool.query('SELECT statut, version FROM demande WHERE id = $1', [DEMANDE])).rows[0];
		expect(d).toEqual({ statut: 'en_cours', version: v + 1 });
	});

	it('consigne un conflit quand la fiche a changé entre-temps, sans écraser', async () => {
		const r = await envoyer([{ op: 'PATCH', table: 'demande', id: DEMANDE, opData: { statut: 'close' }, previousValues: { version: 1 } }]);
		expect(r.json()).toEqual({ appliquees: 0, conflits: 1, rejets: 0 });
		expect((await ctx.pool.query('SELECT statut FROM demande WHERE id = $1', [DEMANDE])).rows[0].statut).toBe('en_cours');
		const c = (await ctx.pool.query(`SELECT * FROM conflit WHERE nature = 'concurrence'`)).rows[0];
		expect(c).toMatchObject({ table_cible: 'demande', ligne_id: DEMANDE, operation: 'PATCH', donnees_appareil: { statut: 'close' } });
		expect(c.donnees_serveur.statut).toBe('en_cours');
	});

	it('une écriture invalide est consignée en rejet et ne bloque pas les suivantes', async () => {
		const autre = 'cccccccc-0000-4000-8000-000000000001';
		const r = await envoyer([
			{ op: 'PUT', table: 'demande', id: autre, opData: { copropriete_id: 'dddddddd-0000-4000-8000-000000000009', titre: 'Orpheline', statut: 'nouvelle' } },
			{ op: 'PUT', table: 'demande', id: 'eeeeeeee-0000-4000-8000-000000000001', opData: { copropriete_id: COPRO, titre: 'X', statut: 'inconnu' } },
			{ op: 'PUT', table: 'table_pirate', id: autre, opData: {} },
			{ op: 'PATCH', table: 'copropriete', id: COPRO, opData: { ville: 'Lyon' }, previousValues: { version: 2 } }
		]);
		expect(r.json()).toEqual({ appliquees: 1, conflits: 0, rejets: 3 });
		expect((await ctx.pool.query('SELECT ville FROM copropriete')).rows[0].ville).toBe('Lyon');
		expect((await ctx.pool.query(`SELECT count(*)::int n FROM conflit WHERE nature = 'rejet'`)).rows[0].n).toBe(3);
	});

	it('supprime', async () => {
		const id = 'ffffffff-0000-4000-8000-000000000001';
		await envoyer([{ op: 'PUT', table: 'tache', id, opData: { titre: 'Appeler le plombier', statut: 'a_faire' } }]);
		const r = await envoyer([{ op: 'DELETE', table: 'tache', id }]);
		expect(r.json().appliquees).toBe(1);
		expect((await ctx.pool.query('SELECT count(*)::int n FROM tache')).rows[0].n).toBe(0);
	});
});

describe('rédaction IA', () => {
	it('assemble le contexte depuis la base et le transmet au worker', async () => {
		let recu: Record<string, unknown> = {};
		const worker = http.createServer((req, res) => {
			let b = '';
			req.on('data', (c) => (b += c));
			req.on('end', () => {
				recu = JSON.parse(b);
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify({ objet: 'Votre fuite', corps: 'Madame…', modele: 'test' }));
			});
		});
		await new Promise<void>((ok) => worker.listen(0, ok));
		config.workerUrl = `http://127.0.0.1:${(worker.address() as AddressInfo).port}`;

		const PERSONNE = 'abababab-0000-4000-8000-000000000001';
		await envoyer([
			{ op: 'PUT', table: 'personne', id: PERSONNE, opData: { copropriete_id: COPRO, nom: 'Dupont', prenom: 'Marie', telephone: '06 12 34 56 78' } },
			{ op: 'PATCH', table: 'demande', id: DEMANDE, opData: { demandeur_id: PERSONNE } }
		]);
		const r = await ctx.app.inject({
			method: 'POST',
			url: '/api/ia/redaction',
			headers: { authorization: `Bearer ${jeton}` },
			payload: { type: 'reponse_coproprietaire', copropriete_id: COPRO, source_type: 'demande', source_id: DEMANDE, destinataire: 'Marie Dupont' }
		});
		worker.close();
		expect(r.statusCode).toBe(200);
		expect(r.json().objet).toBe('Votre fuite');
		expect(recu).toMatchObject({
			type: 'reponse_coproprietaire',
			copropriete: { nom: 'Les Tilleuls' },
			source_type: 'demande',
			source: { titre: 'Fuite', statut: 'en_cours' },
			personnes: [{ nom: 'Dupont', prenom: 'Marie' }],
			destinataire: 'Marie Dupont'
		});
	});

	it('refuse un identifiant mal formé', async () => {
		const r = await ctx.app.inject({
			method: 'POST',
			url: '/api/ia/redaction',
			headers: { authorization: `Bearer ${jeton}` },
			payload: { type: 'relance', copropriete_id: "x' OR 1=1" }
		});
		expect(r.statusCode).toBe(400);
	});
});
