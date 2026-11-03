// Après `vite build` : injecte la liste des fichiers compilés dans build/sw.js
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const build = 'build';
const fichiers = [];
(function parcourir(dossier) {
	for (const nom of readdirSync(dossier)) {
		const chemin = join(dossier, nom);
		if (statSync(chemin).isDirectory()) parcourir(chemin);
		else fichiers.push('/' + relative(build, chemin).split('\\').join('/'));
	}
})(build);

const precache = fichiers.filter((f) => f !== '/sw.js' && f !== '/index.html' && !f.endsWith('.map'));
const version = Date.now().toString(36);
const sw = readFileSync(join(build, 'sw.js'), 'utf8')
	.replace('__VERSION__', version)
	.replace('/*__PRECACHE__*/ []', JSON.stringify(precache));
writeFileSync(join(build, 'sw.js'), sw);
console.log(`sw.js : ${precache.length} fichiers en cache, version ${version}`);
