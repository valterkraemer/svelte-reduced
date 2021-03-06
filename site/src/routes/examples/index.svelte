<script>
	import { sections, examples, get_example } from "./_examples";

	import { onMount } from 'svelte';
	import { goto } from '@sapper/app';
	import Repl from '@sveltejs/svelte-repl';

	import ScreenToggle from '../../components/ScreenToggle.svelte';
	import {
		rollupUrl,
		svelteUrl
	} from '../../config';
	import { process_example } from '../../utils/examples';
	import { getFragment } from '@sveltejs/site-kit/utils/navigation';
	import TableOfContents from './_TableOfContents.svelte';

	let example;
	let width;
	let offset = 1;
	let repl;
	let active_slug;

	function showExampleCodeOnChange() {
		offset = 1;
	}

	$: title = example ? example.title : '';
	$: mobile = width < 768; // note: same as per media query below
	$: replOrientation = (mobile || width > 1080) ? 'columns' : 'rows';
	$: if (repl && active_slug) {
		const example = get_example(active_slug);

		repl.set({ components: example.files });
		showExampleCodeOnChange();
	}

	onMount(() => {
		const onhashchange = () => {
			active_slug = getFragment();
		};
		window.addEventListener('hashchange', onhashchange, false);

		const fragment = getFragment();
		if (fragment) {
			active_slug = fragment;
		} else {
			active_slug = examples[0].slug;
			goto(`examples#${active_slug}`);
		}

		return () => {
			window.removeEventListener('hashchange', onhashchange, false);
		};
	});
</script>

<svelte:head>
	<title>{title} {title ? '•' : ''} Svelte Examples</title>

	<meta name="twitter:title" content="Svelte examples">
	<meta name="twitter:description" content="Cybernetically enhanced web apps">
	<meta name="Description" content="Interactive example Svelte apps">
</svelte:head>

<div class='examples-container' bind:clientWidth={width}>
	<div class="viewport offset-{offset}">
		<TableOfContents sections={sections} active_section={active_slug} isLoading={false} />
		<div class="repl-container">
			<Repl
				bind:this={repl}
				workersUrl="workers"
				{svelteUrl}
				{rollupUrl}
				orientation={replOrientation}
				fixed={mobile}
				relaxed
			/>
		</div>
	</div>
	{#if mobile}
	<ScreenToggle bind:offset labels={['index', 'input', 'output']}/>
	{/if}
</div>

<style>
	.examples-container {
		position: relative;
		height: calc(100vh - var(--nav-h));
		overflow: hidden;
		padding: 0 0 42px 0;
		box-sizing: border-box;
	}

	.viewport {
		display: grid;
		width: 300%;
		height: 100%;
		grid-template-columns: 33.333% 66.666%;
		transition: transform .3s;
		grid-auto-rows: 100%;
	}

	.repl-container.loading {
		opacity: 0.6;
	}

	/* temp fix for #2499 and #2550 while waiting for a fix for https://github.com/sveltejs/svelte-repl/issues/8 */

	.repl-container :global(.tab-content),
	.repl-container :global(.tab-content.visible) {
		pointer-events: all;
		opacity: 1;
	}
	.repl-container :global(.tab-content) {
		visibility: hidden;
	}
	.repl-container :global(.tab-content.visible) {
		visibility: visible;
	}

	.offset-1 { transform: translate(-33.333%, 0); }
	.offset-2 { transform: translate(-66.666%, 0); }

	@media (min-width: 768px) {
		.examples-container { padding: 0 }

		.viewport {
			width: 100%;
			height: 100%;
			display: grid;
			grid-template-columns: var(--sidebar-mid-w) auto;
			grid-auto-rows: 100%;
			transition: none;
		}

		.offset-1, .offset-2 { transform: none; }
	}
</style>
