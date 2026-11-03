import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/config.ts';
import { preparer } from './helpers.ts';

let ctx: Awaited<ReturnType<typeof preparer>>;
let admin: string;
const ALINE = '11111111-1111-4111-8111-111111111111';

const appel = (method: 'GET' | 'POST' | 'PATCH' | 'PUT', url: string, jeton: string, payload?: object) =>
	ctx.app.inject({ method, url, headers: { authorization: `Bearer ${jeton}` }, payload });

beforeAll(async () => {
	ctx = await preparer();
	admin = (await ctx.connexion()).acces;
	config.workerUrl = 'http://127.0.0.1:1'; // injoignable : l'état doit le signaler sans planter
	config.powersyncInterneUrl = 'http://127.0.0.1:1';
});
afterAll(() => ctx.nettoyer());

describe('gestion des utilisateurs', () => {
	let julienId: string;

	it('crée un gestionnaire, qui peut se connecter', async () => {
		const r = await appel('POST', '/api/admin/utilisateurs', admin, { email: 'Julien@Test.fr', nom: 'Julien', role: 'gestionnaire', mot_de_passe: 'un-mot-de-passe-long' });
		expect(r.statusCode).toBe(201);
		julienId = r.json().id;
		const s = await ctx.connexion('julien@test.fr', 'un-mot-de-passe-long');
		expect(s.utilisateur.role).toBe('gestionnaire');
	});

	it('refuse un doublon d’e-mail et un mot de passe trop court', async () => {
		expect((await appel('POST', '/api/admin/utilisateurs', admin, { email: 'julien@test.fr', nom: 'X', role: 'gestionnaire', mot_de_passe: 'un-mot-de-passe-long' })).statusCode).toBe(409);
		expect((await appel('POST', '/api/admin/utilisateurs', admin, { email: 'x@test.fr', nom: 'X', role: 'gestionnaire', mot_de_passe: 'court' })).statusCode).toBe(400);
	});

	it('un gestionnaire n’a pas accès à l’administration', async () => {
		const g = (await ctx.connexion('julien@test.fr', 'un-mot-de-passe-long')).acces;
		expect((await appel('GET', '/api/admin/utilisateurs', g)).statusCode).toBe(403);
		expect((await ctx.app.inject({ url: '/api/admin/utilisateurs' })).statusCode).toBe(401);
	});

	it('liste les comptes avec leurs sessions ouvertes', async () => {
		const r = await appel('GET', '/api/admin/utilisateurs', admin);
		const julien = r.json().find((u: { email: string }) => u.email === 'julien@test.fr');
		expect(julien.sessions.length).toBeGreaterThanOrEqual(2);
		expect(julien.derniere_connexion).toBeTruthy();
	});

	it('promouvoir en administrateur prend effet immédiatement', async () => {
		const g = (await ctx.connexion('julien@test.fr', 'un-mot-de-passe-long')).acces;
		await appel('PATCH', `/api/admin/utilisateurs/${julienId}`, admin, { role: 'admin' });
		expect((await appel('GET', '/api/admin/etat', g)).statusCode).toBe(200);
		await appel('PATCH', `/api/admin/utilisateurs/${julienId}`, admin, { role: 'gestionnaire' });
		expect((await appel('GET', '/api/admin/etat', g)).statusCode).toBe(403);
	});

	it('réinitialiser le mot de passe ferme les sessions', async () => {
		const s = await ctx.connexion('julien@test.fr', 'un-mot-de-passe-long');
		expect((await appel('POST', `/api/admin/utilisateurs/${julienId}/mot-de-passe`, admin, { mot_de_passe: 'nouveau-mot-de-passe' })).statusCode).toBe(200);
		const r = await ctx.app.inject({ method: 'POST', url: '/api/auth/renouveler', payload: { renouvellement: s.renouvellement } });
		expect(r.statusCode).toBe(401);
		expect((await ctx.connexion('julien@test.fr', 'nouveau-mot-de-passe')).acces).toBeTruthy();
	});

	it('désactiver coupe l’accès, même avec un jeton encore valide', async () => {
		const s = await ctx.connexion('julien@test.fr', 'nouveau-mot-de-passe');
		await appel('PATCH', `/api/admin/utilisateurs/${julienId}`, admin, { actif: false });
		expect((await appel('POST', '/api/sync/upload', s.acces, { operations: [] })).statusCode).toBe(401);
		const r = await ctx.app.inject({ method: 'POST', url: '/api/auth/connexion', payload: { email: 'julien@test.fr', mot_de_passe: 'nouveau-mot-de-passe' } });
		expect(r.statusCode).toBe(401);
		await appel('PATCH', `/api/admin/utilisateurs/${julienId}`, admin, { actif: true });
		expect((await ctx.connexion('julien@test.fr', 'nouveau-mot-de-passe')).acces).toBeTruthy();
	});

	it('empêche de retirer le dernier administrateur', async () => {
		expect((await appel('PATCH', `/api/admin/utilisateurs/${ALINE}`, admin, { role: 'gestionnaire' })).statusCode).toBe(400);
		expect((await appel('PATCH', `/api/admin/utilisateurs/${ALINE}`, admin, { actif: false })).statusCode).toBe(400);
	});

	it('déconnecte tous les appareils d’un compte', async () => {
		await ctx.connexion('julien@test.fr', 'nouveau-mot-de-passe');
		const r = await appel('POST', `/api/admin/utilisateurs/${julienId}/deconnecter`, admin);
		expect(r.json().sessions_fermees).toBeGreaterThanOrEqual(1);
	});
});

describe('mon compte', () => {
	it('change son mot de passe avec le mot de passe actuel', async () => {
		const s = await ctx.connexion();
		expect((await appel('POST', '/api/compte/mot-de-passe', s.acces, { actuel: 'faux', nouveau: 'encore-un-autre-mdp' })).statusCode).toBe(400);
		expect((await appel('POST', '/api/compte/mot-de-passe', s.acces, { actuel: 'motdepasse-solide', nouveau: 'encore-un-autre-mdp', renouvellement: s.renouvellement })).statusCode).toBe(200);
		// la session courante est conservée
		expect((await ctx.app.inject({ method: 'POST', url: '/api/auth/renouveler', payload: { renouvellement: s.renouvellement } })).statusCode).toBe(200);
		expect((await ctx.connexion('aline@test.fr', 'encore-un-autre-mdp')).acces).toBeTruthy();
	});
});

describe('état, modèles IA, journal', () => {
	it('donne l’état des services et signale ceux qui sont injoignables', async () => {
		const r = (await appel('GET', '/api/admin/etat', admin)).json();
		expect(r.services.postgres.ok).toBe(true);
		expect(r.services.worker_ia.ok).toBe(false);
		expect(r.services.powersync.ok).toBe(false);
		expect(r.donnees.utilisateurs_actifs).toBe(2);
	});

	it('enregistre les modèles IA, avec retour au défaut si vide', async () => {
		let r = await appel('PUT', '/api/admin/ia', admin, { modeles: { redaction: 'mistralai/mistral-large', chat: '' } });
		expect(r.json().modeles.redaction).toBe('mistralai/mistral-large');
		expect(r.json().modeles.chat).toBe('anthropic/claude-sonnet-4.5');
		r = await appel('PUT', '/api/admin/ia', admin, { modeles: { redaction: 'pas un modèle ;' } });
		expect(r.statusCode).toBe(400);
	});

	it('trace les actions d’administration', async () => {
		const actions = (await appel('GET', '/api/admin/journal', admin)).json().map((j: { action: string }) => j.action);
		for (const a of ['utilisateur_cree', 'utilisateur_desactive', 'utilisateur_reactive', 'mot_de_passe_reinitialise', 'modeles_ia_modifies']) {
			expect(actions).toContain(a);
		}
	});
});

describe('premier lancement', () => {
	it('crée le premier administrateur avec le code des journaux, une seule fois', async () => {
		const vide = await preparer({ vide: true });
		try {
			expect((await vide.app.inject({ url: '/api/auth/initialisation' })).json()).toEqual({ requise: true });
			const corps = { email: 'admin@test.fr', nom: 'Julien', mot_de_passe: 'mot-de-passe-admin' };
			expect((await vide.app.inject({ method: 'POST', url: '/api/auth/initialisation', payload: { ...corps, code: '000000' } })).statusCode).toBe(403);
			const code = vide.app.codeInitialisation()!;
			const r = await vide.app.inject({ method: 'POST', url: '/api/auth/initialisation', payload: { ...corps, code } });
			expect(r.statusCode).toBe(200);
			expect(r.json().utilisateur.role).toBe('admin');
			expect((await vide.app.inject({ method: 'POST', url: '/api/auth/initialisation', payload: { ...corps, code } })).statusCode).toBe(409);
			expect((await vide.app.inject({ url: '/api/auth/initialisation' })).json()).toEqual({ requise: false });
		} finally {
			await vide.nettoyer();
		}
	});
});
