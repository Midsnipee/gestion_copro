import type { Module } from '../modules/definitions';

/** Construit la requête SQLite (locale) d'une liste de module. Les noms de tables et
 * de colonnes viennent uniquement des définitions ; les saisies passent en paramètres. */
export function requeteListe(
	m: Module,
	o: { recherche?: string; filtres?: Record<string, string>; coproId?: string; termines?: boolean; limite?: number }
) {
	const refs = m.champs.filter((c) => c.type === 'ref');
	const etiquettes = refs.map((c) => `(SELECT ${c.affichage} FROM ${c.table} WHERE id = t.${c.nom}) AS "${c.nom}__libelle"`);
	const where: string[] = [];
	const params: unknown[] = [];

	if (o.coproId && m.parCopro) {
		where.push('t.copropriete_id = ?');
		params.push(o.coproId);
	}
	for (const [champ, valeur] of Object.entries(o.filtres ?? {})) {
		if (!valeur || !m.filtres?.includes(champ)) continue;
		where.push(`t.${champ} = ?`);
		params.push(valeur);
	}
	if (m.termine && !o.termines && !o.filtres?.[m.termine.champ]) {
		where.push(`coalesce(t.${m.termine.champ}, '') NOT IN (${m.termine.valeurs.map(() => '?').join(', ')})`);
		params.push(...m.termine.valeurs);
	}
	const q = o.recherche?.trim();
	if (q && m.recherche.length) {
		where.push(`(${m.recherche.map((c) => `lower(coalesce(t.${c}, '')) LIKE ?`).join(' OR ')})`);
		params.push(...m.recherche.map(() => `%${q.toLowerCase()}%`));
	}

	const sql = `SELECT t.*${etiquettes.length ? ', ' + etiquettes.join(', ') : ''}
		FROM ${m.table} t
		${where.length ? 'WHERE ' + where.join(' AND ') : ''}
		ORDER BY ${m.tri}
		LIMIT ${o.limite ?? 500}`;
	return { sql, params };
}
