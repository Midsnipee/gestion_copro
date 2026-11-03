// Gestion des comptes :
//   node dist/cli.js utilisateur <email> "<nom>"   (mot de passe demandé, ou variable MOT_DE_PASSE)
//   node dist/cli.js desactiver <email>
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { config } from './config.ts';
import { creerPool } from './db.ts';
import { migrer } from './migrate.ts';
import { hacher } from './motdepasse.ts';

const [commande, email, nom] = process.argv.slice(2);
const pool = creerPool(config.databaseUrl);
await migrer(pool, process.env.MIGRATIONS_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations'), () => {});

if (commande === 'utilisateur' && email) {
	let mdp = process.env.MOT_DE_PASSE;
	if (!mdp) {
		const rl = createInterface({ input: process.stdin, output: process.stdout });
		mdp = await rl.question('Mot de passe (12 caractères min.) : ');
		rl.close();
	}
	if (mdp.length < 12) throw new Error('Mot de passe trop court');
	await pool.query(
		`INSERT INTO utilisateur (email, nom, mot_de_passe) VALUES (lower($1), $2, $3)
		 ON CONFLICT (email) DO UPDATE SET nom = EXCLUDED.nom, mot_de_passe = EXCLUDED.mot_de_passe, actif = true`,
		[email, nom ?? email, await hacher(mdp)]
	);
	console.log(`Compte ${email} enregistré.`);
} else if (commande === 'desactiver' && email) {
	await pool.query('UPDATE utilisateur SET actif = false WHERE lower(email) = lower($1)', [email]);
	await pool.query('DELETE FROM jeton_renouvellement j USING utilisateur u WHERE j.utilisateur_id = u.id AND lower(u.email) = lower($1)', [email]);
	console.log(`Compte ${email} désactivé.`);
} else {
	console.log('Usage : cli.js utilisateur <email> "<nom>" | cli.js desactiver <email>');
}
await pool.end();
