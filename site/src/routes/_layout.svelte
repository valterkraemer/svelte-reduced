<script>
	import { stores } from '@sapper/app';
	import { Icon, Icons, Nav, NavItem } from '@sveltejs/site-kit';

	export let segment;

	const { page } = stores();
</script>

<Icons/>

{#if $page.path !== '/repl/embed'}
	<Nav {segment} {page} logo="svelte-logo-horizontal.svg">
		<NavItem segment="examples">Examples</NavItem>
		<NavItem segment="repl">REPL</NavItem>

		<NavItem external="https://github.com/valterkraemer/svelte-reduced" title="GitHub Repo">
			<Icon name="github"/>
		</NavItem>
	</Nav>
{/if}

<main>
	<slot></slot>
</main>

<style>
	main {
		position: relative;
		margin: 0 auto;
		/* padding: var(--nav-h) var(--side-nav) 0 var(--side-nav); */
		padding: var(--nav-h) 0 0 0;
		overflow-x: hidden;
	}
</style>
