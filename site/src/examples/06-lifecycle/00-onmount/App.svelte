<script>
	import { onMount } from 'svelte';

	let photos = [];

	onMount(async () => {
		const res = await fetch(`https://jsonplaceholder.typicode.com/photos?_limit=20`);
		photos = await res.json();
	});
</script>

<style>
	.photos {
		width: 100%;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		grid-gap: 8px;
	}

	figure, img {
		width: 100%;
		margin: 0;
	}
</style>

<h1>Photo album</h1>

<div class="photos">
	{#if photos.length}
		<figure>
			<img src={photos[0].thumbnailUrl} alt={photos[0].title}>
			<figcaption>{photos[0].title}</figcaption>
		</figure>
	{:else}
		<p>loading...</p>
	{/if}
</div>
