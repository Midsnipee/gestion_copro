<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { pb } from '../lib/pb';
	import { demarrerSynchro, etat, synchroniser, viderDonneesLocales } from '../lib/sync.svelte';
	import '../app.css';

	let { children } = $props();
	let connecte = $state(pb.authStore.isValid);

	$effect(() => pb.authStore.onChange(() => (connecte = pb.authStore.isValid)));

	$effect(() => {
		if (!connecte && page.url.pathname !== '/connexion') goto('/connexion');
	});

	$effect(() => {
		if (!connecte) return;
		return demarrerSynchro();
	});

	$effect(() => {
		if ('serviceWorker' in navigator && !import.meta.env.DEV) {
			navigator.serviceWorker.register('/sw.js');
		}
	});

	async function deconnexion() {
		pb.authStore.clear();
		await viderDonneesLocales();
		goto('/connexion');
	}

	const libelleSync = $derived(
		!etat.enLigne
			? `Hors ligne${etat.enAttente ? ` · ${etat.enAttente} en attente` : ''}`
			: etat.enCours
				? 'Synchronisation…'
				: etat.erreur
					? 'Erreur de synchro'
					: etat.enAttente
						? `${etat.enAttente} en attente`
						: 'À jour'
	);
</script>

{#if connecte}
	<header>
		<a class="marque" href="/">Gestion copro</a>
		<nav>
			<a href="/" class:actif={page.url.pathname === '/'}>Copropriétés</a>
		</nav>
		<button
			class="sync"
			class:hors-ligne={!etat.enLigne}
			class:erreur={!!etat.erreur}
			title={etat.erreur || 'Synchroniser maintenant'}
			onclick={() => synchroniser()}
		>
			<span class="pastille"></span>{libelleSync}
		</button>
		<button class="lien" onclick={deconnexion}>Déconnexion</button>
	</header>
{/if}

<main>
	{@render children()}
</main>
