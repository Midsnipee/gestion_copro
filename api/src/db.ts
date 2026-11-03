import pg from 'pg';

// Les colonnes date restent des chaînes 'AAAA-MM-JJ' (pas de conversion en Date locale)
pg.types.setTypeParser(1082, (v) => v);
// numeric -> nombre
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

export type Pool = pg.Pool;
export const creerPool = (url: string) => new pg.Pool({ connectionString: url, max: 10 });
