// Gestion des comptes :
//   node dist/cli.js utilisateur <email> "<nom>" [admin]   (mot de passe demandé, ou variable MOT_DE_PASSE)
//   Le premier compte créé est toujours administrateur. L'écran Administration fait le reste.
//   node dist/cli.js desactiver <email>
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { config } from './config.ts';
import { creerPool } from './db.ts';
import { migrer } from './migrate.ts';
import { hacher } from './motdepasse.ts';

const [commande, email, nom, option] = process.argv.slice(2);
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
	const premier = (await pool.query('SELECT 1 FROM utilisateur LIMIT 1')).rowCount === 0;
	const role = premier || option === 'admin' ? 'admin' : null;
	await pool.query(
		`INSERT INTO utilisateur (email, nom, mot_de_passe, role) VALUES (lower($1), $2, $3, coalesce($4, 'gestionnaire'))
		 ON CONFLICT (email) DO UPDATE SET nom = EXCLUDED.nom, mot_de_passe = EXCLUDED.mot_de_passe, actif = true,
		   role = coalesce($4, utilisateur.role)`,
		[email, nom ?? email, await hacher(mdp), role]
	);
	console.log(`Compte ${email} enregistré${role ? ' (administrateur)' : ''}.`);
} else if (commande === 'desactiver' && email) {
	await pool.query('UPDATE utilisateur SET actif = false WHERE lower(email) = lower($1)', [email]);
	await pool.query('DELETE FROM jeton_renouvellement j USING utilisateur u WHERE j.utilisateur_id = u.id AND lower(u.email) = lower($1)', [email]);
	console.log(`Compte ${email} désactivé.`);
} else {
	console.log('Usage : cli.js utilisateur <email> "<nom>" [admin] | cli.js desactiver <email>');
}
await pool.end();
