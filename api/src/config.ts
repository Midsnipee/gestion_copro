export const config = {
	port: Number(process.env.PORT ?? 3000),
	databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/copro',
	clesDir: process.env.CLES_DIR ?? './data/cles',
	/** URL publique du service PowerSync, transmise aux appareils */
	powersyncUrl: process.env.POWERSYNC_URL ?? '/powersync',
	/** URL interne du service PowerSync (sonde de l'écran d'administration) */
	powersyncInterneUrl: process.env.POWERSYNC_INTERNE_URL ?? 'http://127.0.0.1:8080',
	workerUrl: process.env.AI_WORKER_URL ?? 'http://127.0.0.1:8000',
	dureeAccesS: Number(process.env.DUREE_ACCES_S ?? 3600),
	dureeRenouvellementJ: Number(process.env.DUREE_RENOUVELLEMENT_J ?? 60)
};

export const AUDIENCE = ['powersync', 'copro-api'];
