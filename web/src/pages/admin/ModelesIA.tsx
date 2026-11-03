import { useEffect, useState } from 'react';
import { api } from '../../lib/session';
import { useRessource } from './commun';

interface ConfigIA {
	taches: Record<string, { libelle: string; defaut: string }>;
	modeles: Record<string, string>;
}

export function ModelesIA() {
	const { donnees, erreur } = useRessource<ConfigIA>('/api/admin/ia');
	const [modeles, setModeles] = useState<Record<string, string>>({});
	const [message, setMessage] = useState('');

	useEffect(() => {
		if (donnees) setModeles(donnees.modeles);
	}, [donnees]);

	async function enregistrer() {
		setMessage('');
		try {
			const r = await api<{ modeles: Record<string, string> }>('/api/admin/ia', { modeles }, 'PUT');
			setModeles(r.modeles);
			setMessage('Modèles enregistrés.');
		} catch (e) {
			setMessage((e as Error).message);
		}
	}

	return (
		<>
			<h2>Modèles IA</h2>
			<p className="secondaire">
				Identifiants OpenRouter (catalogue sur{' '}
				<a href="https://openrouter.ai/models" target="_blank" rel="noreferrer">
					openrouter.ai/models
				</a>
				). Laisser vide pour revenir au modèle par défaut. Les données personnelles sont toujours pseudonymisées avant envoi.
			</p>
			{erreur && <p className="erreur">{erreur}</p>}
			{donnees && (
				<div className="carte formulaire">
					{Object.entries(donnees.taches).map(([t, d]) => (
						<label key={t}>
							{d.libelle}
							<input value={modeles[t] ?? ''} placeholder={d.defaut} onChange={(e) => setModeles({ ...modeles, [t]: e.target.value })} />
						</label>
					))}
					{message && <p className={message.endsWith('.') && message.startsWith('Modèles') ? 'aide' : 'erreur'}>{message}</p>}
					<button onClick={enregistrer}>Enregistrer</button>
				</div>
			)}
		</>
	);
}
