import { useQuery, useStatus } from '@powersync/react';
import { useEffect, useState } from 'react';

/** Identifiants des fiches modifiées sur cet appareil et pas encore reçues par le serveur. */
export function useEnAttente(): Set<string> {
	const { data } = useQuery<{ id: string }>(`SELECT DISTINCT json_extract(data, '$.id') AS id FROM ps_crud`);
	return new Set(data.map((r) => r.id));
}

function useEnLigne() {
	const [enLigne, setEnLigne] = useState(navigator.onLine);
	useEffect(() => {
		const maj = () => setEnLigne(navigator.onLine);
		window.addEventListener('online', maj);
		window.addEventListener('offline', maj);
		return () => {
			window.removeEventListener('online', maj);
			window.removeEventListener('offline', maj);
		};
	}, []);
	return enLigne;
}

/** Indicateur global : synchronisé, ou nombre de modifications gardées sur cet appareil. */
export function EtatSync() {
	const statut = useStatus();
	const enLigne = useEnLigne();
	const enAttente = useEnAttente().size;
	const connecte = enLigne && statut.connected;

	let libelle: string;
	let classe = '';
	if (!connecte) {
		classe = 'hors-ligne';
		libelle = enAttente ? `Hors ligne · ${enAttente} enregistrée(s) sur cet appareil` : 'Hors ligne';
	} else if (enAttente || statut.dataFlowStatus.uploading) {
		libelle = `Envoi de ${enAttente || '…'} modification(s)`;
	} else if (!statut.hasSynced) {
		libelle = 'Première synchronisation…';
	} else {
		libelle = 'Synchronisé';
	}
	const erreur = statut.dataFlowStatus.uploadError ?? statut.dataFlowStatus.downloadError;
	if (connecte && erreur) classe = 'erreur';

	return (
		<span className={`sync ${classe}`} title={erreur?.message ?? (statut.lastSyncedAt ? `Dernière synchro : ${statut.lastSyncedAt.toLocaleString('fr-FR')}` : '')}>
			<span className="pastille" />
			{libelle}
		</span>
	);
}

/** Badge par fiche : « Sur cet appareil » tant que le serveur ne l'a pas reçue. */
export function BadgeLocal({ id, enAttente }: { id: string; enAttente: Set<string> }) {
	return enAttente.has(id) ? <span className="badge local" title="Enregistré sur cet appareil, pas encore synchronisé">Sur cet appareil</span> : null;
}
