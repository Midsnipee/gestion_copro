import { useStatus } from '@powersync/react';
import { dateHeure, useRessource } from './commun';

interface Etat {
	services: {
		api: { ok: boolean };
		postgres: { ok: boolean; version: string; taille: string };
		powersync: { ok: boolean; detail?: string; replication: { slot_name: string; active: boolean; retard: string }[] };
		worker_ia: { ok: boolean; detail?: string; llm_configure?: boolean };
	};
	donnees: Record<string, number>;
}

const LIBELLES: Record<string, string> = {
	coproprietes: 'Copropriétés',
	demandes_ouvertes: 'Demandes ouvertes',
	courriers_brouillon: 'Courriers en brouillon',
	conflits: 'Conflits à trancher',
	utilisateurs_actifs: 'Utilisateurs actifs',
	sessions_ouvertes: 'Appareils connectés'
};

function Service({ nom, ok, detail }: { nom: string; ok: boolean; detail?: string }) {
	return (
		<div className={`service ${ok ? 'ok' : 'ko'}`}>
			<span className="pastille" />
			<div>
				<strong>{nom}</strong>
				<span className="secondaire">{detail}</span>
			</div>
		</div>
	);
}

export function EtatSysteme() {
	const { donnees: e, erreur, enCours, recharger } = useRessource<Etat>('/api/admin/etat');
	const statut = useStatus();

	return (
		<>
			<div className="entete">
				<h2>État du système</h2>
				<button className="secondaire-btn" onClick={recharger} disabled={enCours}>
					{enCours ? 'Vérification…' : 'Actualiser'}
				</button>
			</div>
			{erreur && <p className="erreur">{erreur}</p>}
			{e && (
				<>
					<div className="grille-services">
						<Service nom="API" ok={e.services.api.ok} detail="Répond" />
						<Service nom="PostgreSQL" ok={e.services.postgres.ok} detail={`v${e.services.postgres.version} · ${e.services.postgres.taille}`} />
						<Service
							nom="PowerSync"
							ok={e.services.powersync.ok && e.services.powersync.replication.some((r) => r.active)}
							detail={
								e.services.powersync.ok
									? e.services.powersync.replication.map((r) => `réplication ${r.active ? 'active' : 'arrêtée'}, retard ${r.retard}`).join(' · ') || 'aucune réplication'
									: `injoignable (${e.services.powersync.detail})`
							}
						/>
						<Service
							nom="Worker IA"
							ok={e.services.worker_ia.ok && e.services.worker_ia.llm_configure !== false}
							detail={
								!e.services.worker_ia.ok ? `injoignable (${e.services.worker_ia.detail})` : e.services.worker_ia.llm_configure ? 'Clé OpenRouter configurée' : 'Clé OpenRouter manquante (.env)'
							}
						/>
					</div>

					<h3>Cet appareil</h3>
					<p className="secondaire">
						{statut.connected ? 'Connecté au flux de synchronisation' : 'Non connecté au flux de synchronisation'} · dernière synchronisation :{' '}
						{dateHeure(statut.lastSyncedAt?.toISOString())}
					</p>

					<h3>Données</h3>
					<div className="grille-chiffres">
						{Object.entries(e.donnees).map(([k, v]) => (
							<div key={k} className="chiffre">
								<strong>{v}</strong>
								<span className="secondaire">{LIBELLES[k] ?? k}</span>
							</div>
						))}
					</div>
				</>
			)}
		</>
	);
}
