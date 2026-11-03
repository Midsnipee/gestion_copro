<script lang="ts">
	import { goto } from '$app/navigation';
	import { pb } from '../../lib/pb';

	let email = $state('');
	let motDePasse = $state('');
	let erreur = $state('');
	let enCours = $state(false);

	async function connexion(e: SubmitEvent) {
		e.preventDefault();
		erreur = '';
		enCours = true;
		try {
			await pb.collection('users').authWithPassword(email, motDePasse);
			goto('/');
		} catch {
			erreur = navigator.onLine ? 'Identifiants incorrects.' : 'Connexion impossible hors ligne.';
		} finally {
			enCours = false;
		}
	}
</script>

<section class="connexion">
	<h1>Gestion copro</h1>
	<form onsubmit={connexion}>
		<label>E-mail <input type="email" bind:value={email} required autocomplete="username" /></label>
		<label>
			Mot de passe
			<input type="password" bind:value={motDePasse} required autocomplete="current-password" />
		</label>
		{#if erreur}<p class="erreur">{erreur}</p>{/if}
		<button type="submit" disabled={enCours}>{enCours ? 'Connexion…' : 'Se connecter'}</button>
	</form>
	<p class="aide">Une fois connectée, l'application reste utilisable hors ligne.</p>
</section>
