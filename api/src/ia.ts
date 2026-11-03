import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { modelesIA } from './admin.ts';
import { config } from './config.ts';
import type { Pool } from './db.ts';

const TYPES = [
	'relance',
	'mise_en_demeure',
	'convocation',
	'demande_devis',
	'reponse_coproprietaire',
	'information',
	'rapport_visite',
	'compte_rendu_cs'
];
const SOURCES = ['demande', 'visite', 'reunion', 'chantier'] as const;
const UUID = '^[0-9a-fA-F-]{36}$';

interface Corps {
	type: string;
	copropriete_id: string;
	source_type?: (typeof SOURCES)[number];
	source_id?: string;
	destinataire?: string;
	consignes?: string;
}

/**
 * Rédaction IA : l'API assemble le contexte depuis la base (droits vérifiés ici),
 * le worker IA, interne, se charge de la pseudonymisation et de l'appel au modèle.
 */
export function routesIA(app: FastifyInstance, pool: Pool, exigerSession: preHandlerAsyncHookHandler) {
	app.post<{ Body: Corps }>(
		'/api/ia/redaction',
		{
			preHandler: exigerSession,
			schema: {
				body: {
					type: 'object',
					required: ['type', 'copropriete_id'],
					additionalProperties: false,
					properties: {
						type: { enum: TYPES },
						copropriete_id: { type: 'string', pattern: UUID },
						source_type: { enum: SOURCES },
						source_id: { type: 'string', pattern: UUID },
						destinataire: { type: 'string', maxLength: 200 },
						consignes: { type: 'string', maxLength: 2000 }
					}
				}
			}
		},
		async (req, rep) => {
			const b = req.body;
			const copro = (await pool.query('SELECT nom, adresse, code_postal, ville FROM copropriete WHERE id = $1', [b.copropriete_id])).rows[0];
			if (!copro) return rep.code(404).send({ erreur: 'Copropriété inconnue (pas encore synchronisée ?)' });

			let source: Record<string, unknown> | null = null;
			const personnes: Record<string, unknown>[] = [];
			if (b.source_type && b.source_id) {
				// source_type est contrôlé par le schéma (liste fermée)
				const s = (await pool.query(`SELECT * FROM "${b.source_type}" WHERE id = $1`, [b.source_id])).rows[0];
				if (!s) return rep.code(404).send({ erreur: 'Élément source inconnu (pas encore synchronisé ?)' });
				if (s.copropriete_id !== b.copropriete_id) return rep.code(400).send({ erreur: "La source n'appartient pas à cette copropriété" });
				source = s;
				if (b.source_type === 'demande' && s.demandeur_id) {
					const p = (await pool.query('SELECT nom, prenom, email, telephone, adresse_postale FROM personne WHERE id = $1', [s.demandeur_id])).rows[0];
					if (p) personnes.push(p);
				}
			}

			const r = await fetch(`${config.workerUrl}/redaction`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: b.type,
					copropriete: copro,
					source_type: b.source_type ?? null,
					source,
					personnes,
					destinataire: b.destinataire ?? null,
					consignes: b.consignes ?? '',
					modele: (await modelesIA(pool)).redaction
				}),
				signal: AbortSignal.timeout(150_000)
			}).catch((e: Error) => {
				throw Object.assign(new Error(`Worker IA injoignable : ${e.message}`), { statusCode: 502 });
			});
			const donnees = await r.json().catch(() => ({}));
			if (!r.ok) return rep.code(502).send({ erreur: donnees.detail ?? `Worker IA : ${r.status}` });
			return donnees;
		}
	);
}
