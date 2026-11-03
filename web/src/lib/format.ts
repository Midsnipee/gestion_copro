const date = (v: unknown) => {
	if (!v) return null;
	const s = String(v);
	// 'AAAA-MM-JJ' = date sans heure : pas de conversion de fuseau
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
		const [a, m, j] = s.split('-').map(Number);
		return new Date(a, m - 1, j);
	}
	const d = new Date(s.replace(' ', 'T'));
	return Number.isNaN(d.getTime()) ? null : d;
};

export const fDate = (v: unknown) => date(v)?.toLocaleDateString('fr-FR') ?? '';
export const fDateHeure = (v: unknown) =>
	date(v)?.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) ?? '';
export const fEuros = (v: unknown) =>
	v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const fNombre = (v: unknown) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('fr-FR'));

export function fTags(v: unknown): string[] {
	if (!v) return [];
	try {
		const t = JSON.parse(String(v));
		return Array.isArray(t) ? t.map(String) : [];
	} catch {
		return [];
	}
}

/** « dans 3 jours », « il y a 2 jours », « aujourd'hui » */
export function relatif(v: unknown): string {
	const d = date(v);
	if (!d) return '';
	const auj = new Date();
	auj.setHours(0, 0, 0, 0);
	const j = new Date(d);
	j.setHours(0, 0, 0, 0);
	const n = Math.round((j.getTime() - auj.getTime()) / 86400000);
	if (n === 0) return "aujourd'hui";
	if (n === 1) return 'demain';
	if (n === -1) return 'hier';
	return n > 0 ? `dans ${n} jours` : `il y a ${-n} jours`;
}

export const pourInputDate = (v: unknown) => (v ? String(v).slice(0, 10) : '');
export const pourInputDateHeure = (v: unknown) => {
	const d = date(v);
	if (!d) return '';
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
