import { SvelteComponent, init, safe_not_equal } from "svelte/internal";

function instance($$self) {
	const a = 1 + 2;
	return [];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, null, safe_not_equal, {});
	}
}

export default Component;
