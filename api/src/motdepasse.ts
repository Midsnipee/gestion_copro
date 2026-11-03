import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt) as (p: string, s: Buffer, l: number, o: object) => Promise<Buffer>;
const N = 16384;

export async function hacher(motDePasse: string): Promise<string> {
	const sel = randomBytes(16);
	const h = await scrypt(motDePasse, sel, 32, { N });
	return `scrypt$${N}$${sel.toString('base64')}$${h.toString('base64')}`;
}

export async function verifier(motDePasse: string, stocke: string): Promise<boolean> {
	const [algo, n, sel, h] = stocke.split('$');
	if (algo !== 'scrypt') return false;
	const attendu = Buffer.from(h, 'base64');
	const calcule = await scrypt(motDePasse, Buffer.from(sel, 'base64'), attendu.length, { N: Number(n) });
	return timingSafeEqual(attendu, calcule);
}
