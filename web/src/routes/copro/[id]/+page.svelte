<script lang="ts">
	import { page } from '$app/state';
	import { db } from '../../../lib/db';
	import { rediger, type TypeCourrier } from '../../../lib/ia';
	import { CATEGORIES_DEMANDE, PRIORITES, STATUTS_DEMANDE, TYPES_COURRIER, dateCourte } from '../../../lib/libelles';
	import { live } from '../../../lib/live.svelte';
	import { ecrire, etat } from '../../../lib/sync.svelte';

	const id = $derived(page.params.id!);

	const copro = live(() => id, (i) => db.copropriete.get(i), undefined);
	const demandes = live(
		() => id,
		(i) => db.demande.where('copropriete').equals(i).reverse().sortBy('updated'),
		[]
	);
	const courriers = live(
		() => id,
		(i) => db.courrier.where('copropriete').equals(i).reverse().sortBy('updated'),
		[]
	);

	// --- Nouvelle demande (fonctionne hors ligne) ---
	let formDemande = $state(false);
	let titre = $state('');
	let description = $state('');
	let categorie = $state('fuite');
	let priorite = $state('normale');

	async function creerDemande(e: SubmitEvent) {
		e.preventDefault();
		await ecrire('demande', 'create', {
			copropriete: id,
			titre,
			description: description ? `<p>${echapper(description).replace(/\n/g, '<br>')}</p>` : '',
			categorie,
			priorite,
			statut: 'nouvelle'
		});
		titre = description = '';
		formDemande = false;
	}

	const changerStatut = (demandeId: string, statut: string) =>
		ecrire('demande', 'update', { id: demandeId, statut });

	// --- Courrier rédigé par l'IA ---
	let typeCourrier = $state<TypeCourrier>('reponse_coproprietaire');
	let sourceDemande = $state('');
	let destinataire = $state('');
	let consignes = $state('');
	let redaction = $state<{ objet: string; corps: string } | null>(null);
	let iaEnCours = $state(false);
	let iaErreur = $state('');

	async function lancerRedaction(e: SubmitEvent) {
		e.preventDefault();
		iaEnCours = true;
		iaErreur = '';
		try {
			const b = await rediger({
				type: typeCourrier,
				copropriete_id: id,
				source_type: sourceDemande ? 'demande' : undefined,
				source_id: sourceDemande || undefined,
				destinataire: destinataire || undefined,
				consignes: consignes || undefined
			});
			redaction = { objet: b.objet, corps: b.corps };
		} catch (err) {
			iaErreur = (err as Error).message;
		} finally {
			iaEnCours = false;
		}
	}

	async function enregistrerBrouillon() {
		if (!redaction) return;
		await ecrire('courrier', 'create', {
			copropriete: id,
			type: typeCourrier,
			destinataire: destinataire || '—',
			objet: redaction.objet,
			corps: redaction.corps
				.split(/\n{2,}/)
				.map((p) => `<p>${echapper(p).replace(/\n/g, '<br>')}</p>`)
				.join(''),
			statut: 'brouillon',
			source_type: sourceDemande ? 'demande' : '',
			source_id: sourceDemande
		});
		redaction = null;
		consignes = '';
	}

	function echapper(s: string) {
		return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
	}
</script>

{#if copro.pret && !copro.valeur}
	<p class="vide">Copropriété introuvable. <a href="/">Retour</a></p>
{:else if copro.valeur}
	{@const c = copro.valeur}
	<a class="retour" href="/">← Copropriétés</a>
	<h1>{c.nom}</h1>
	<p class="secondaire">{c.adresse}{c.code_postal ? ` ${c.code_postal}` : ''}{c.ville ? ` ${c.ville}` : ''}</p>

	<section>
		<div class="entete">
			<h2>Demandes</h2>
			<button onclick={() => (formDemande = !formDemande)}>{formDemande ? 'Annuler' : '+ Demande'}</button>
		</div>

		{#if formDemande}
			<form class="carte formulaire" onsubmit={creerDemande}>
				<label>Titre <input bind:value={titre} required placeholder="Fuite plafond salle de bain, 3e étage" /></label>
				<div class="ligne">
					<label>
						Catégorie
						<select bind:value={categorie}>
							{#each Object.entries(CATEGORIES_DEMANDE) as [v, l] (v)}<option value={v}>{l}</option>{/each}
						</select>
					</label>
					<label>
						Priorité
						<select bind:value={priorite}>
							{#each Object.entries(PRIORITES) as [v, l] (v)}<option value={v}>{l}</option>{/each}
						</select>
					</label>
				</div>
				<label>Description <textarea bind:value={description} rows="4"></textarea></label>
				<button type="submit">Enregistrer{etat.enLigne ? '' : ' (hors ligne)'}</button>
			</form>
		{/if}

		{#if demandes.valeur.length === 0}
			<p class="vide">Aucune demande.</p>
		{:else}
			<ul class="liste">
				{#each demandes.valeur as d (d.id)}
					<li class="demande">
						<div>
							<strong>{d.titre}</strong>
							<span class="secondaire">
								{CATEGORIES_DEMANDE[String(d.categorie)] ?? ''} · {dateCourte(d.created ?? d.updated)}
							</span>
						</div>
						<span class={`priorite p-${d.priorite}`}>{PRIORITES[String(d.priorite)] ?? ''}</span>
						<select
							value={d.statut}
							onchange={(e) => changerStatut(d.id, e.currentTarget.value)}
							aria-label="Statut"
						>
							{#each Object.entries(STATUTS_DEMANDE) as [v, l] (v)}<option value={v}>{l}</option>{/each}
						</select>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section>
		<h2>Rédiger un courrier</h2>
		<form class="carte formulaire" onsubmit={lancerRedaction}>
			<div class="ligne">
				<label>
					Type
					<select bind:value={typeCourrier}>
						{#each Object.entries(TYPES_COURRIER) as [v, l] (v)}<option value={v}>{l}</option>{/each}
					</select>
				</label>
				<label>
					À propos de
					<select bind:value={sourceDemande}>
						<option value="">— Aucune demande —</option>
						{#each demandes.valeur as d (d.id)}<option value={d.id}>{d.titre}</option>{/each}
					</select>
				</label>
			</div>
			<label>Destinataire <input bind:value={destinataire} placeholder="Mme Marie Dupont" /></label>
			<label>
				Consignes
				<textarea bind:value={consignes} rows="2" placeholder="Rappeler le passage du plombier prévu jeudi"></textarea>
			</label>
			{#if iaErreur}<p class="erreur">{iaErreur}</p>{/if}
			<button type="submit" disabled={iaEnCours || !etat.enLigne}>
				{iaEnCours ? 'Rédaction…' : etat.enLigne ? 'Rédiger avec l’IA' : 'Rédaction IA indisponible hors ligne'}
			</button>
		</form>

		{#if redaction}
			<div class="carte formulaire brouillon">
				<label>Objet <input bind:value={redaction.objet} /></label>
				<label>Corps <textarea bind:value={redaction.corps} rows="16"></textarea></label>
				<div class="ligne">
					<button onclick={enregistrerBrouillon}>Enregistrer le brouillon</button>
					<button class="secondaire-btn" onclick={() => (redaction = null)}>Abandonner</button>
				</div>
			</div>
		{/if}

		{#if courriers.valeur.length}
			<h3>Courriers</h3>
			<ul class="liste">
				{#each courriers.valeur as co (co.id)}
					<li>
						<strong>{co.objet || TYPES_COURRIER[String(co.type)]}</strong>
						<span class="secondaire">
							{co.destinataire} · {co.statut} · {dateCourte(co.updated)}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
