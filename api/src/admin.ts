import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { erreurHttp, MDP_MIN, type Role } from './auth.ts';
import { config } from './config.ts';
import type { Pool } from './db.ts';
import { hacher } from './motdepasse.ts';

/** Tâches IA et modèles par défaut (surchargés depuis l'écran d'administration). */
export const TACHES_IA = {
	redaction: { libelle: 'Rédaction des courriers et rapports', defaut: 'anthropic/claude-sonnet-4.5' },
	chat: { libelle: 'Chatbot sur les copropriétés', defaut: 'anthropic/claude-sonnet-4.5' },
	extraction: { libelle: 'Classification et extraction des documents', defaut: 'google/gemini-2.5-flash' }
} as const;
export type TacheIA = keyof typeof TACHES_IA;

export async function modelesIA(pool: Pool): Promise<Record<TacheIA, string>> {
	const { rows } = await pool.query(`SELECT valeur FROM parametre WHERE cle = 'ia.modeles'`);
	const enregistres = (rows[0]?.valeur ?? {}) as Partial<Record<TacheIA, string>>;
	return Object.fromEntries(Object.entries(TACHES_IA).map(([t, d]) => [t, enregistres[t as TacheIA] || d.defaut])) as Record<TacheIA, string>;
}

const ROLES: Role[] = ['admin', 'gestionnaire'];
const UUID = '^[0-9a-fA-F-]{36}$';
const schemaId = { type: 'object', required: ['id'], properties: { id: { type: 'string', pattern: UUID } } };

async function sonder(url: string): Promise<{ ok: boolean; detail?: string }> {
	try {
		const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
		return r.ok ? { ok: true } : { ok: false, detail: `HTTP ${r.status}` };
	} catch (e) {
		return { ok: false, detail: (e as Error).message };
	}
}

export function routesAdmin(app: FastifyInstance, pool: Pool, exigerAdmin: preHandlerAsyncHookHandler) {
	const journal = (auteur: string, action: string, cible: string, details?: unknown) =>
		pool.query('INSERT INTO journal_admin (auteur_id, action, cible, details) VALUES ($1, $2, $3, $4)', [auteur, action, cible, details ? JSON.stringify(details) : null]);

	/** Empêche de se retrouver sans administrateur actif. */
	async function resteUnAdmin(saufId: string) {
		const { rows } = await pool.query(`SELECT count(*)::int n FROM utilisateur WHERE role = 'admin' AND actif AND id <> $1`, [saufId]);
		if (rows[0].n === 0) throw erreurHttp(400, 'Il doit rester au moins un administrateur actif');
	}

	app.register(async (admin) => {
		admin.addHook('preHandler', exigerAdmin);

		// --- Utilisateurs ---------------------------------------------------
		admin.get('/api/admin/utilisateurs', async () => {
			const { rows } = await pool.query(`
				SELECT u.id, u.email, u.nom, u.role, u.actif, u.created, u.derniere_connexion,
					coalesce(json_agg(json_build_object('appareil', j.appareil, 'depuis', j.created) ORDER BY j.created DESC)
						FILTER (WHERE j.hash IS NOT NULL), '[]') AS sessions
				FROM utilisateur u
				LEFT JOIN jeton_renouvellement j ON j.utilisateur_id = u.id AND j.expire > now()
				GROUP BY u.id
				ORDER BY u.actif DESC, u.nom`);
			return rows;
		});

		admin.post<{ Body: { email: string; nom: string; role: Role; mot_de_passe: string } }>(
			'/api/admin/utilisateurs',
			{
				schema: {
					body: {
						type: 'object',
						required: ['email', 'nom', 'role', 'mot_de_passe'],
						additionalProperties: false,
						properties: {
							email: { type: 'string', format: 'email', maxLength: 200 },
							nom: { type: 'string', minLength: 1, maxLength: 100 },
							role: { enum: ROLES },
							mot_de_passe: { type: 'string', minLength: MDP_MIN, maxLength: 200 }
						}
					}
				}
			},
			async (req, rep) => {
				const b = req.body;
				const existe = await pool.query('SELECT 1 FROM utilisateur WHERE lower(email) = lower($1)', [b.email.trim()]);
				if (existe.rowCount) return rep.code(409).send({ erreur: 'Un compte existe déjà avec cet e-mail' });
				const { rows } = await pool.query(
					'INSERT INTO utilisateur (email, nom, role, mot_de_passe) VALUES (lower($1), $2, $3, $4) RETURNING id, email, nom, role, actif, created',
					[b.email.trim(), b.nom.trim(), b.role, await hacher(b.mot_de_passe)]
				);
				await journal(req.utilisateur!.id, 'utilisateur_cree', rows[0].email, { role: b.role });
				return rep.code(201).send(rows[0]);
			}
		);

		admin.patch<{ Params: { id: string }; Body: { email?: string; nom?: string; role?: Role; actif?: boolean } }>(
			'/api/admin/utilisateurs/:id',
			{
				schema: {
					params: schemaId,
					body: {
						type: 'object',
						additionalProperties: false,
						minProperties: 1,
						properties: {
							email: { type: 'string', format: 'email', maxLength: 200 },
							nom: { type: 'string', minLength: 1, maxLength: 100 },
							role: { enum: ROLES },
							actif: { type: 'boolean' }
						}
					}
				}
			},
			async (req, rep) => {
				const { id } = req.params;
				const b = req.body;
				const avant = (await pool.query('SELECT email, nom, role, actif FROM utilisateur WHERE id = $1', [id])).rows[0];
				if (!avant) return rep.code(404).send({ erreur: 'Compte inconnu' });
				if ((b.role && b.role !== 'admin') || b.actif === false) {
					if (avant.role === 'admin' && avant.actif) await resteUnAdmin(id);
				}
				if (b.email) {
					const pris = await pool.query('SELECT 1 FROM utilisateur WHERE lower(email) = lower($1) AND id <> $2', [b.email.trim(), id]);
					if (pris.rowCount) return rep.code(409).send({ erreur: 'Un compte existe déjà avec cet e-mail' });
				}
				const { rows } = await pool.query(
					`UPDATE utilisateur SET
						email = coalesce(lower($2), email), nom = coalesce($3, nom), role = coalesce($4, role), actif = coalesce($5, actif)
					 WHERE id = $1 RETURNING id, email, nom, role, actif`,
					[id, b.email?.trim() ?? null, b.nom?.trim() ?? null, b.role ?? null, b.actif ?? null]
				);
				// Un compte désactivé perd ses sessions : ses appareils ne se synchronisent plus
				if (b.actif === false) await pool.query('DELETE FROM jeton_renouvellement WHERE utilisateur_id = $1', [id]);
				const changements = Object.fromEntries(Object.entries(b).filter(([k, v]) => avant[k] !== v).map(([k, v]) => [k, { avant: avant[k], apres: v }]));
				await journal(req.utilisateur!.id, b.actif === false ? 'utilisateur_desactive' : b.actif === true && !avant.actif ? 'utilisateur_reactive' : 'utilisateur_modifie', rows[0].email, changements);
				return rows[0];
			}
		);

		admin.post<{ Params: { id: string }; Body: { mot_de_passe: string } }>(
			'/api/admin/utilisateurs/:id/mot-de-passe',
			{
				schema: {
					params: schemaId,
					body: { type: 'object', required: ['mot_de_passe'], properties: { mot_de_passe: { type: 'string', minLength: MDP_MIN, maxLength: 200 } } }
				}
			},
			async (req, rep) => {
				const { rows } = await pool.query('UPDATE utilisateur SET mot_de_passe = $2 WHERE id = $1 RETURNING email', [req.params.id, await hacher(req.body.mot_de_passe)]);
				if (!rows[0]) return rep.code(404).send({ erreur: 'Compte inconnu' });
				await pool.query('DELETE FROM jeton_renouvellement WHERE utilisateur_id = $1', [req.params.id]);
				await journal(req.utilisateur!.id, 'mot_de_passe_reinitialise', rows[0].email);
				return { ok: true };
			}
		);

		admin.post<{ Params: { id: string } }>('/api/admin/utilisateurs/:id/deconnecter', { schema: { params: schemaId } }, async (req, rep) => {
			const u = (await pool.query('SELECT email FROM utilisateur WHERE id = $1', [req.params.id])).rows[0];
			if (!u) return rep.code(404).send({ erreur: 'Compte inconnu' });
			const { rowCount } = await pool.query('DELETE FROM jeton_renouvellement WHERE utilisateur_id = $1', [req.params.id]);
			await journal(req.utilisateur!.id, 'appareils_deconnectes', u.email, { sessions: rowCount });
			return { sessions_fermees: rowCount };
		});

		// --- État du système ------------------------------------------------
		admin.get('/api/admin/etat', async () => {
			const [pg, taille, slots, compteurs, powersync, worker] = await Promise.all([
				pool.query('SHOW server_version'),
				pool.query('SELECT pg_size_pretty(pg_database_size(current_database())) AS taille'),
				pool.query(`SELECT slot_name, active, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS retard
					FROM pg_replication_slots WHERE plugin = 'pgoutput' AND database = current_database()`),
				pool.query(`SELECT
					(SELECT count(*)::int FROM copropriete) AS coproprietes,
					(SELECT count(*)::int FROM demande WHERE statut NOT IN ('resolue', 'close')) AS demandes_ouvertes,
					(SELECT count(*)::int FROM courrier WHERE statut = 'brouillon') AS courriers_brouillon,
					(SELECT count(*)::int FROM conflit) AS conflits,
					(SELECT count(*)::int FROM utilisateur WHERE actif) AS utilisateurs_actifs,
					(SELECT count(*)::int FROM jeton_renouvellement WHERE expire > now()) AS sessions_ouvertes`),
				sonder(`${config.powersyncInterneUrl}/probes/liveness`),
				fetch(`${config.workerUrl}/health`, { signal: AbortSignal.timeout(3000) })
					.then(async (r) => ({ ok: r.ok, ...(r.ok ? { llm_configure: (await r.json()).llm_configure } : { detail: `HTTP ${r.status}` }) }))
					.catch((e: Error) => ({ ok: false, detail: e.message }))
			]);
			return {
				services: {
					api: { ok: true },
					postgres: { ok: true, version: pg.rows[0].server_version, taille: taille.rows[0].taille },
					powersync: { ...powersync, replication: slots.rows },
					worker_ia: worker
				},
				donnees: compteurs.rows[0]
			};
		});

		// --- Modèles IA -----------------------------------------------------
		admin.get('/api/admin/ia', async () => ({
			taches: Object.fromEntries(Object.entries(TACHES_IA).map(([t, d]) => [t, { libelle: d.libelle, defaut: d.defaut }])),
			modeles: await modelesIA(pool)
		}));

		admin.put<{ Body: { modeles: Partial<Record<TacheIA, string>> } }>(
			'/api/admin/ia',
			{
				schema: {
					body: {
						type: 'object',
						required: ['modeles'],
						properties: {
							modeles: {
								type: 'object',
								additionalProperties: false,
								properties: Object.fromEntries(Object.keys(TACHES_IA).map((t) => [t, { type: 'string', maxLength: 120, pattern: '^[A-Za-z0-9._:/-]*$' }]))
							}
						}
					}
				}
			},
			async (req) => {
				const propres = Object.fromEntries(Object.entries(req.body.modeles).filter(([, v]) => v?.trim()).map(([k, v]) => [k, v!.trim()]));
				await pool.query(
					`INSERT INTO parametre (cle, valeur) VALUES ('ia.modeles', $1)
					 ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, updated = now()`,
					[JSON.stringify(propres)]
				);
				await journal(req.utilisateur!.id, 'modeles_ia_modifies', 'ia', propres);
				return { modeles: await modelesIA(pool) };
			}
		);

		// --- Journal --------------------------------------------------------
		admin.get('/api/admin/journal', async () => {
			const { rows } = await pool.query(`
				SELECT j.id, j.action, j.cible, j.details, j.created, u.nom AS auteur
				FROM journal_admin j LEFT JOIN utilisateur u ON u.id = j.auteur_id
				ORDER BY j.created DESC LIMIT 200`);
			return rows;
		});
	});
}
