import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { jwtVerify, SignJWT, createLocalJWKSet } from 'jose';
import type { Cles } from './cles.ts';
import { AUDIENCE, config } from './config.ts';
import type { Pool } from './db.ts';
import { verifier } from './motdepasse.ts';

export interface Utilisateur {
	id: string;
	email: string;
	nom: string;
}

declare module 'fastify' {
	interface FastifyRequest {
		utilisateur?: Utilisateur;
	}
}

const ISSUER = 'gestion-copro';
const hash = (jeton: string) => createHash('sha256').update(jeton).digest('hex');

export function routesAuth(app: FastifyInstance, pool: Pool, cles: Cles) {
	const jwks = createLocalJWKSet(cles.jwks);

	async function emettre(u: Utilisateur) {
		const acces = await new SignJWT({ email: u.email, nom: u.nom })
			.setProtectedHeader({ alg: 'RS256', kid: cles.kid })
			.setSubject(u.id)
			.setIssuer(ISSUER)
			.setAudience(AUDIENCE)
			.setIssuedAt()
			.setExpirationTime(`${config.dureeAccesS}s`)
			.sign(cles.privee);
		const renouvellement = randomBytes(32).toString('base64url');
		await pool.query(
			`INSERT INTO jeton_renouvellement (hash, utilisateur_id, expire)
			 VALUES ($1, $2, now() + make_interval(days => $3))`,
			[hash(renouvellement), u.id, config.dureeRenouvellementJ]
		);
		return { acces, renouvellement, expire_dans: config.dureeAccesS, utilisateur: u, powersync_url: config.powersyncUrl };
	}

	// Clés publiques lues par PowerSync pour valider les jetons des appareils
	app.get('/api/.well-known/jwks.json', async () => cles.jwks);

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
				'SELECT id, email, nom, mot_de_passe FROM utilisateur WHERE lower(email) = lower($1) AND actif',
				[req.body.email.trim()]
			);
			const u = rows[0];
			if (!u || !(await verifier(req.body.mot_de_passe, u.mot_de_passe))) {
				return rep.code(401).send({ erreur: 'Identifiants incorrects' });
			}
			return emettre({ id: u.id, email: u.email, nom: u.nom });
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
				 RETURNING j.expire, u.id, u.email, u.nom`,
				[hash(req.body.renouvellement)]
			);
			const r = rows[0];
			if (!r || new Date(r.expire) < new Date()) return rep.code(401).send({ erreur: 'Session expirée' });
			return emettre({ id: r.id, email: r.email, nom: r.nom });
		}
	);

	app.post<{ Body: { renouvellement?: string } }>('/api/auth/deconnexion', async (req) => {
		if (req.body?.renouvellement) {
			await pool.query('DELETE FROM jeton_renouvellement WHERE hash = $1', [hash(req.body.renouvellement)]);
		}
		return { ok: true };
	});

	/** À utiliser en preHandler sur les routes protégées. */
	return async function exigerSession(req: FastifyRequest) {
		const entete = req.headers.authorization ?? '';
		const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : '';
		try {
			const { payload } = await jwtVerify(jeton, jwks, { issuer: ISSUER, audience: 'copro-api' });
			req.utilisateur = { id: payload.sub!, email: String(payload.email), nom: String(payload.nom) };
		} catch {
			const e = new Error('Session invalide') as Error & { statusCode: number };
			e.statusCode = 401;
			throw e;
		}
	};
}
