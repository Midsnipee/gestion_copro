import Fastify from 'fastify';
import { routesAuth } from './auth.ts';
import type { Cles } from './cles.ts';
import type { Pool } from './db.ts';
import { routesIA } from './ia.ts';
import { ErreurPassagere, traiterLot, type Operation } from './upload.ts';

export function creerApp(pool: Pool, cles: Cles, opts: { logger?: boolean } = {}) {
	const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 10 * 1024 * 1024 });

	app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, req, rep) => {
		const code = err.statusCode ?? 500;
		if (code >= 500) req.log.error(err);
		rep.code(code).send({ erreur: code >= 500 ? 'Erreur serveur' : err.message });
	});

	app.get('/api/sante', async () => {
		await pool.query('SELECT 1');
		return { ok: true };
	});

	const exigerSession = routesAuth(app, pool, cles);

	// Envoi des écritures locales des appareils (appelé par le connecteur PowerSync)
	app.post<{ Body: { operations: Operation[] } }>(
		'/api/sync/upload',
		{
			preHandler: exigerSession,
			schema: {
				body: {
					type: 'object',
					required: ['operations'],
					properties: {
						operations: {
							type: 'array',
							maxItems: 1000,
							items: {
								type: 'object',
								required: ['op', 'table', 'id'],
								properties: {
									op: { enum: ['PUT', 'PATCH', 'DELETE'] },
									table: { type: 'string', maxLength: 64 },
									id: { type: 'string', maxLength: 64 },
									opData: { type: 'object' },
									previousValues: { type: 'object' }
								}
							}
						}
					}
				}
			}
		},
		async (req, rep) => {
			try {
				return await traiterLot(pool, req.body.operations, req.utilisateur!.id);
			} catch (e) {
				if (e instanceof ErreurPassagere) {
					req.log.error(e);
					return rep.code(503).send({ erreur: 'Base indisponible, réessayer' });
				}
				throw e;
			}
		}
	);

	routesIA(app, pool, exigerSession);

	return app;
}
