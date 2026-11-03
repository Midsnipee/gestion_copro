import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { creerApp } from './app.ts';
import { chargerCles } from './cles.ts';
import { config } from './config.ts';
import { creerPool } from './db.ts';
import { migrer } from './migrate.ts';

const ici = dirname(fileURLToPath(import.meta.url));
const pool = creerPool(config.databaseUrl);
await migrer(pool, process.env.MIGRATIONS_DIR ?? join(ici, '..', 'migrations'));
const app = creerApp(pool, await chargerCles(config.clesDir), { logger: true });
await app.listen({ host: '0.0.0.0', port: config.port });

for (const s of ['SIGTERM', 'SIGINT']) {
	process.on(s, async () => {
		await app.close();
		await pool.end();
		process.exit(0);
	});
}
