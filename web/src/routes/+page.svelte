<script lang="ts">
	import { db } from '../lib/db';
	import { live } from '../lib/live.svelte';
	import { ecrire } from '../lib/sync.svelte';

	let recherche = $state('');
	let ajout = $state(false);
	let nom = $state('');
	let adresse = $state('');
	let ville = $state('');

	const copros = live(
		() => null,
		() => db.copropriete.orderBy('updated').reverse().toArray(),
		[]
	);
	const demandesOuvertes = live(
		() => null,
		async () => {
			const ouvertes = await db.demande.filter((d) => !['resolue', 'close'].includes(String(d.statut))).toArray();
			const parCopro: Record<string, number> = {};
			for (const d of ouvertes) parCopro[String(d.copropriete)] = (parCopro[String(d.copropriete)] ?? 0) + 1;
			return parCopro;
		},
		{} as Record<string, number>
	);

	const normaliser = (s: unknown) =>
		String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

	const filtrees = $derived.by(() => {
		const q = normaliser(recherche);
		const liste = [...copros.valeur].sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
		if (!q) return liste;
		return liste.filter((c) =>
			[c.nom, c.adresse, c.ville, ...((c.alias as string[]) ?? [])].some((v) => normaliser(v).includes(q))
		);
	});

	async function creer(e: SubmitEvent) {
		e.preventDefault();
		await ecrire('copropriete', 'create', { nom, adresse, ville, alias: [] });
		nom = adresse = ville = '';
		ajout = false;
	}
</script>

<div class="entete">
	<h1>Copropriétés <span class="compte">{copros.valeur.length}</span></h1>
	<button onclick={() => (ajout = !ajout)}>{ajout ? 'Annuler' : '+ Copropriété'}</button>
</div>

{#if ajout}
	<form class="carte formulaire" onsubmit={creer}>
		<label>Nom <input bind:value={nom} required placeholder="Résidence Les Tilleuls" /></label>
		<label>Adresse <input bind:value={adresse} required placeholder="12 rue des Lilas" /></label>
		<label>Ville <input bind:value={ville} /></label>
		<button type="submit">Créer</button>
	</form>
{/if}

<input class="recherche" type="search" placeholder="Rechercher par nom, adresse, alias…" bind:value={recherche} />

{#if copros.pret && copros.valeur.length === 0}
	<p class="vide">Aucune copropriété pour l'instant.</p>
{:else}
	<ul class="liste">
		{#each filtrees as c (c.id)}
			<li>
				<a href={`/copro/${c.id}`}>
					<strong>{c.nom}</strong>
					<span class="secondaire">{c.adresse}{c.ville ? `, ${c.ville}` : ''}</span>
					{#if demandesOuvertes.valeur[c.id]}
						<span class="badge">{demandesOuvertes.valeur[c.id]} demande(s) ouverte(s)</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
{/if}
