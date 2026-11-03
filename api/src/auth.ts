import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { jwtVerify, SignJWT, createLocalJWKSet } from 'jose';
import type { Cles } from './cles.ts';
import { AUDIENCE, config } from './config.ts';
import type { Pool } from './db.ts';
import { hacher, verifier } from './motdepasse.ts';

export type Role = 'admin' | 'gestionnaire';

export interface Utilisateur {
	id: string;
	email: string;
	nom: string;
	role: Role;
}

declare module 'fastify' {
	interface FastifyRequest {
		utilisateur?: Utilisateur;
	}
}

const ISSUER = 'gestion-copro';
export const hashJeton = (jeton: string) => createHash('sha256').update(jeton).digest('hex');
export const MDP_MIN = 12;

export const erreurHttp = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });

const schemaMotDePasse = { type: 'string', minLength: MDP_MIN, maxLength: 200 };
const schemaEmail = { type: 'string', format: 'email', maxLength: 200 };

/** Libellé court de l'appareil, pour la liste des sessions. */
function appareil(req: FastifyRequest): string {
	const ua = String(req.headers['user-agent'] ?? '');
	const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Inconnu';
	const nav = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
	return [nav, os].filter(Boolean).join(' · ');
}

export function routesAuth(app: FastifyInstance, pool: Pool, cles: Cles) {
	const jwks = createLocalJWKSet(cles.jwks);

	// Premier lancement : tant qu'aucun compte n'existe, un code à usage unique est écrit
	// dans les journaux du serveur ; il permet de créer le premier administrateur depuis l'écran.
	let codeInitialisation: string | null = null;
	const aucunCompte = async () => (await pool.query('SELECT 1 FROM utilisateur LIMIT 1')).rowCount === 0;
	app.addHook('onReady', async () => {
		if (await aucunCompte()) {
			codeInitialisation = String(randomInt(100000, 999999));
			app.log.warn(`Aucun compte : code d'initialisation pour créer l'administrateur = ${codeInitialisation}`);
			console.log(`\n  Code d'initialisation (premier administrateur) : ${codeInitialisation}\n`);
		}
	});
	app.decorate('codeInitialisation', () => codeInitialisation);

	async function emettre(u: Utilisateur, req: FastifyRequest) {
		const acces = await new SignJWT({ email: u.email, nom: u.nom, role: u.role })
			.setProtectedHeader({ alg: 'RS256', kid: cles.kid })
			.setSubject(u.id)
			.setIssuer(ISSUER)
			.setAudience(AUDIENCE)
			.setIssuedAt()
			.setExpirationTime(`${config.dureeAccesS}s`)
			.sign(cles.privee);
		const renouvellement = randomBytes(32).toString('base64url');
		await pool.query(
			`INSERT INTO jeton_renouvellement (hash, utilisateur_id, expire, appareil)
			 VALUES ($1, $2, now() + make_interval(days => $3), $4)`,
			[hashJeton(renouvellement), u.id, config.dureeRenouvellementJ, appareil(req)]
		);
		await pool.query('UPDATE utilisateur SET derniere_connexion = now() WHERE id = $1', [u.id]);
		return { acces, renouvellement, expire_dans: config.dureeAccesS, utilisateur: u, powersync_url: config.powersyncUrl };
	}

	// Clés publiques lues par PowerSync pour valider les jetons des appareils
	app.get('/api/.well-known/jwks.json', async () => cles.jwks);

	app.get('/api/auth/initialisation', async () => ({ requise: await aucunCompte() }));

	app.post<{ Body: { code: string; email: string; nom: string; mot_de_passe: string } }>(
		'/api/auth/initialisation',
		{
			schema: {
				body: {
					type: 'object',
					required: ['code', 'email', 'nom', 'mot_de_passe'],
					properties: { code: { type: 'string' }, email: schemaEmail, nom: { type: 'string', minLength: 1, maxLength: 100 }, mot_de_passe: schemaMotDePasse }
				}
			}
		},
		async (req, rep) => {
			if (!codeInitialisation || !(await aucunCompte())) return rep.code(409).send({ erreur: 'Un compte existe déjà' });
			if (req.body.code.trim() !== codeInitialisation) return rep.code(403).send({ erreur: "Code d'initialisation incorrect" });
			const { rows } = await pool.query(
				`INSERT INTO utilisateur (email, nom, mot_de_passe, role) VALUES (lower($1), $2, $3, 'admin')
				 RETURNING id, email, nom, role`,
				[req.body.email.trim(), req.body.nom.trim(), await hacher(req.body.mot_de_passe)]
			);
			codeInitialisation = null;
			await pool.query(`INSERT INTO journal_admin (auteur_id, action, cible) VALUES ($1, 'initialisation', $2)`, [rows[0].id, rows[0].email]);
			return emettre(rows[0], req);
		}
	);

	app.post<{ Body: { email: string; mot_de_passe: string } }>(
		'/api/auth/connexion',
		{
			schema: {
				body: {
					type: 'object',
					required: ['email', 'mot_de_passe'],
					properties: { email: { type: 'string', maxLength: 200 }, mot_de_passe: { type: 'string', maxLength: 200 } }
				}
			}
		},
		async (req, rep) => {
			const { rows } = await pool.query(
				'SELECT id, email, nom, role, mot_de_passe FROM utilisateur WHERE lower(email) = lower($1) AND actif',
				[req.body.email.trim()]
			);
			const u = rows[0];
			if (!u || !(await verifier(req.body.mot_de_passe, u.mot_de_passe))) {
				return rep.code(401).send({ erreur: 'Identifiants incorrects' });
			}
			return emettre({ id: u.id, email: u.email, nom: u.nom, role: u.role }, req);
		}
	);

	app.post<{ Body: { renouvellement: string } }>(
		'/api/auth/renouveler',
		{ schema: { body: { type: 'object', required: ['renouvellement'], properties: { renouvellement: { type: 'string' } } } } },
		async (req, rep) => {
			// Jeton à usage unique : supprimé à l'utilisation (rotation)
			const { rows } = await pool.query(
				`DELETE FROM jeton_renouvellement j USING utilisateur u
				 WHERE j.hash = $1 AND j.utilisateur_id = u.id AND u.actif
				 RETURNING j.expire, u.id, u.email, u.nom, u.role`,
				[hashJeton(req.body.renouvellement)]
			);
			const r = rows[0];
			if (!r || new Date(r.expire) < new Date()) return rep.code(401).send({ erreur: 'Session expirée' });
			return emettre({ id: r.id, email: r.email, nom: r.nom, role: r.role }, req);
		}
	);

	app.post<{ Body: { renouvellement?: string } }>('/api/auth/deconnexion', async (req) => {
		if (req.body?.renouvellement) {
			await pool.query('DELETE FROM jeton_renouvellement WHERE hash = $1', [hashJeton(req.body.renouvellement)]);
		}
		return { ok: true };
	});

	/** preHandler des routes protégées : jeton valide ET compte toujours actif (rôle relu en base). */
	async function exigerSession(req: FastifyRequest) {
		const entete = req.headers.authorization ?? '';
		const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : '';
		let sub: string;
		try {
			const { payload } = await jwtVerify(jeton, jwks, { issuer: ISSUER, audience: 'copro-api' });
			sub = payload.sub!;
		} catch {
			throw erreurHttp(401, 'Session invalide');
		}
		const { rows } = await pool.query('SELECT id, email, nom, role FROM utilisateur WHERE id = $1 AND actif', [sub]);
		if (!rows[0]) throw erreurHttp(401, 'Compte désactivé');
		req.utilisateur = rows[0];
	}

	async function exigerAdmin(req: FastifyRequest) {
		await exigerSession(req);
		if (req.utilisateur!.role !== 'admin') throw erreurHttp(403, 'Réservé aux administrateurs');
	}

	// Mon compte : changer son propre mot de passe (les autres appareils sont déconnectés)
	app.post<{ Body: { actuel: string; nouveau: string; renouvellement?: string } }>(
		'/api/compte/mot-de-passe',
		{
			preHandler: exigerSession,
			schema: {
				body: {
					type: 'object',
					required: ['actuel', 'nouveau'],
					properties: { actuel: { type: 'string', maxLength: 200 }, nouveau: schemaMotDePasse, renouvellement: { type: 'string' } }
				}
			}
		},
		async (req, rep) => {
			const u = req.utilisateur!;
			const { rows } = await pool.query('SELECT mot_de_passe FROM utilisateur WHERE id = $1', [u.id]);
			if (!(await verifier(req.body.actuel, rows[0].mot_de_passe))) return rep.code(400).send({ erreur: 'Mot de passe actuel incorrect' });
			await pool.query('UPDATE utilisateur SET mot_de_passe = $2 WHERE id = $1', [u.id, await hacher(req.body.nouveau)]);
			await pool.query('DELETE FROM jeton_renouvellement WHERE utilisateur_id = $1 AND hash <> $2', [u.id, hashJeton(req.body.renouvellement ?? '')]);
			await pool.query(`INSERT INTO journal_admin (auteur_id, action, cible) VALUES ($1, 'mot_de_passe_modifie', $2)`, [u.id, u.email]);
			return { ok: true };
		}
	);

	return { exigerSession, exigerAdmin };
}

declare module 'fastify' {
	interface FastifyInstance {
		codeInitialisation: () => string | null;
	}
}
