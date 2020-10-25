<script>
	export let count;
</script>

<span>{count}</span>

{#if count > 1}
	<Countdown count={count - 1}/>
{/if}
