<script>
	let y;
</script>

<svelte:window bind:scrollY={y}/>

<a class="parallax-container" href="https://www.firewatchgame.com">
	<img
		src="https://www.firewatchgame.com/images/parallax/parallax0.png"
		alt="parallax layer 0"
	>
	<img
		style="transform: translate(0,{-y * 1 / 8}px)"
		src="https://www.firewatchgame.com/images/parallax/parallax1.png"
		alt="parallax layer 1"
	>
	<img
		style="transform: translate(0,{-y * 2 / 8}px)"
		src="https://www.firewatchgame.com/images/parallax/parallax2.png"
		alt="parallax layer 2"
	>
	<img
		style="transform: translate(0,{-y * 3 / 8}px)"
		src="https://www.firewatchgame.com/images/parallax/parallax3.png"
		alt="parallax layer 3"
	>
	<img
		style="transform: translate(0,{-y * 4 / 8}px)"
		src="https://www.firewatchgame.com/images/parallax/parallax4.png"
		alt="parallax layer 4"
	>
	<img
		style="transform: translate(0,{-y * 5 / 8}px)"
		src="https://www.firewatchgame.com/images/parallax/parallax5.png"
		alt="parallax layer 5"
	>
	<img
		style="transform: translate(0,{-y * 6 / 8}px)"
		src="https://www.firewatchgame.com/images/parallax/parallax6.png"
		alt="parallax layer 6"
	>
	<img
		style="transform: translate(0,{-y * 7 / 8}px)"
		src="https://www.firewatchgame.com/images/parallax/parallax7.png"
		alt="parallax layer 7"
	>
	<img
		style="transform: translate(0,{-y}px)"
		src="https://www.firewatchgame.com/images/parallax/parallax8.png"
		alt="parallax layer 8"
	>
</a>

<div class="text">
	<span style="opacity: {1 - Math.max(0, y / 40)}">
		scroll down
	</span>

	<div class="foreground">
		You have scrolled {y} pixels
	</div>
</div>

<style>
	.parallax-container {
		position: fixed;
		width: 2400px;
		height: 712px;
		left: 50%;
		transform: translate(-50%,0);
	}

	.parallax-container img {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		will-change: transform;
	}

	.parallax-container img:last-child::after {
		content: '';
		position: absolute;
		width: 100%;
		height: 100%;
		background: rgb(45,10,13);
	}

	.text {
		position: relative;
		width: 100%;
		height: 300vh;
		color: rgb(220,113,43);
		text-align: center;
		padding: 4em 0.5em 0.5em 0.5em;
		box-sizing: border-box;
		pointer-events: none;
	}

	span {
		display: block;
		font-size: 1em;
		text-transform: uppercase;
		will-change: transform, opacity;
	}

	.foreground {
		position: absolute;
		top: 711px;
		left: 0;
		width: 100%;
		height: calc(100% - 712px);
		background-color: rgb(32,0,1);
		color: white;
		padding: 50vh 0 0 0;
	}

	:global(body) {
		margin: 0;
		padding: 0;
		background-color: rgb(253, 174, 51);
	}
</style>
