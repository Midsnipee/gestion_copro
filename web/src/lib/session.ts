// Session stockée sur l'appareil : permet d'ouvrir l'application hors ligne.
export interface Session {
	acces: string;
	renouvellement: string;
	utilisateur: { id: string; email: string; nom: string; role: 'admin' | 'gestionnaire' };
	powersync_url: string;
}

const CLE = 'copro.session';

export function lireSession(): Session | null {
	try {
		const s = localStorage.getItem(CLE);
		return s ? (JSON.parse(s) as Session) : null;
	} catch {
		return null;
	}
}

export function ecrireSession(s: Session | null) {
	try {
		if (s) localStorage.setItem(CLE, JSON.stringify(s));
		else localStorage.removeItem(CLE);
	} catch {
		/* stockage indisponible : la session reste en mémoire */
	}
	ecouteurs.forEach((f) => f(s));
}

const ecouteurs = new Set<(s: Session | null) => void>();
export const surSession = (f: (s: Session | null) => void) => {
	ecouteurs.add(f);
	return () => ecouteurs.delete(f);
};

/** Secondes restantes avant expiration du jeton d'accès. */
export function resteValide(jeton: string): number {
	try {
		const { exp } = JSON.parse(atob(jeton.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
		return exp - Date.now() / 1000;
	} catch {
		return 0;
	}
}

export async function connexion(email: string, motDePasse: string): Promise<Session> {
	const r = await fetch('/api/auth/connexion', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, mot_de_passe: motDePasse })
	});
	if (!r.ok) throw new Error(r.status === 401 ? 'Identifiants incorrects.' : `Erreur ${r.status}`);
	const s = (await r.json()) as Session;
	ecrireSession(s);
	return s;
}

/** Premier lancement : création du premier administrateur avec le code affiché dans les journaux du serveur. */
export async function initialiser(params: { code: string; email: string; nom: string; mot_de_passe: string }): Promise<Session> {
	const r = await fetch('/api/auth/initialisation', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(params)
	});
	const donnees = await r.json().catch(() => ({}));
	if (!r.ok) throw new Error(donnees.erreur ?? donnees.message ?? `Erreur ${r.status}`);
	ecrireSession(donnees as Session);
	return donnees as Session;
}

let renouvellementEnCours: Promise<Session> | null = null;

/** Jeton d'accès valide, renouvelé si besoin (ou si `forcer`). Lève une erreur hors ligne. */
export async function jetonValide(forcer = false): Promise<string> {
	const s = lireSession();
	if (!s) throw new Error('Non connectée');
	if (!forcer && resteValide(s.acces) > 60) return s.acces;
	renouvellementEnCours ??= (async () => {
		try {
			const r = await fetch('/api/auth/renouveler', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ renouvellement: s.renouvellement })
			});
			if (r.status === 401) {
				ecrireSession(null);
				throw new Error('Session expirée, reconnectez-vous.');
			}
			if (!r.ok) throw new Error(`Renouvellement impossible (${r.status})`);
			const nouvelle = (await r.json()) as Session;
			ecrireSession(nouvelle);
			return nouvelle;
		} finally {
			renouvellementEnCours = null;
		}
	})();
	return (await renouvellementEnCours).acces;
}

/** Appel d'API authentifié (POST par défaut). */
export async function api<T>(chemin: string, corps?: unknown, methode = 'POST'): Promise<T> {
	const envoyer = async (jeton: string) =>
		fetch(chemin, {
			method: corps === undefined && methode === 'POST' ? 'GET' : methode,
			headers: { ...(corps !== undefined ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${jeton}` },
			body: corps !== undefined ? JSON.stringify(corps) : undefined
		});
	let r = await envoyer(await jetonValide());
	// Jeton refusé (compte modifié, désactivé…) : on renouvelle une fois. Si le renouvellement
	// est refusé, la session est fermée et l'appareil revient à l'écran de connexion.
	if (r.status === 401) r = await envoyer(await jetonValide(true));
	const donnees = await r.json().catch(() => ({}));
	if (!r.ok) throw Object.assign(new Error(donnees.erreur ?? `Erreur ${r.status}`), { status: r.status });
	return donnees as T;
}
