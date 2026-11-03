import type { AbstractPowerSyncDatabase, PowerSyncBackendConnector } from '@powersync/web';
import { api, jetonValide, lireSession } from './session';

export class Connecteur implements PowerSyncBackendConnector {
	async fetchCredentials() {
		const token = await jetonValide();
		const url = lireSession()!.powersync_url;
		return { endpoint: new URL(url, window.location.origin).toString().replace(/\/+$/, ''), token };
	}

	/** Envoie la file d'écritures locales à l'API, par lots. */
	async uploadData(db: AbstractPowerSyncDatabase) {
		const lot = await db.getCrudBatch(200);
		if (!lot) return;
		const operations = lot.crud.map((c) => ({
			op: c.op,
			table: c.table,
			id: c.id,
			opData: c.opData,
			previousValues: c.previousValues
		}));
		try {
			await api('/api/sync/upload', { operations });
		} catch (e) {
			const status = (e as { status?: number }).status;
			// 400 : lot mal formé (bogue) — on ne bloque pas la file indéfiniment.
			// Le serveur consigne déjà chaque écriture refusée dans « conflit ».
			if (status === 400) {
				console.error('Lot refusé par le serveur', e, operations);
			} else {
				throw e; // réseau, 401, 5xx : PowerSync réessaiera
			}
		}
		await lot.complete();
	}
}
