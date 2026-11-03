import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportJWK, exportPKCS8, exportSPKI, generateKeyPair, importPKCS8, importSPKI, type JWK } from 'jose';

export interface Cles {
	kid: string;
	privee: CryptoKey;
	jwks: { keys: JWK[] };
}

/** Paire RS256 persistée sur disque : PowerSync vérifie les jetons via le JWKS public. */
export async function chargerCles(dossier: string): Promise<Cles> {
	const fPriv = join(dossier, 'privee.pem');
	const fPub = join(dossier, 'publique.pem');
	if (!existsSync(fPriv)) {
		mkdirSync(dossier, { recursive: true });
		const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
		writeFileSync(fPriv, await exportPKCS8(privateKey), { mode: 0o600 });
		writeFileSync(fPub, await exportSPKI(publicKey));
	}
	const pemPub = readFileSync(fPub, 'utf8');
	const privee = await importPKCS8(readFileSync(fPriv, 'utf8'), 'RS256');
	const publique = await importSPKI(pemPub, 'RS256', { extractable: true });
	const jwk = await exportJWK(publique);
	const kid = (await import('node:crypto')).createHash('sha256').update(pemPub).digest('hex').slice(0, 16);
	return { kid, privee, jwks: { keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }] } };
}
