import {
	SvelteComponent,
	create_component,
	destroy_component,
	detach,
	init,
	insert,
	mount_component,
	noop,
	safe_not_equal,
	space
} from "svelte/internal";

import Imported from "Imported.svelte";

function create_fragment(ctx) {
	let imported;
	let t;
	let nonimported;
	imported = new Imported({});
	nonimported = new NonImported({});

	return {
		c() {
			create_component(imported.$$.fragment);
			t = space();
			create_component(nonimported.$$.fragment);
		},
		m(target, anchor) {
			mount_component(imported, target, anchor);
			insert(target, t, anchor);
			mount_component(nonimported, target, anchor);
		},
		p: noop,
		d(detaching) {
			destroy_component(imported, detaching);
			if (detaching) detach(t);
			destroy_component(nonimported, detaching);
		}
	};
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment, safe_not_equal, {});
	}
}

export default Component;
