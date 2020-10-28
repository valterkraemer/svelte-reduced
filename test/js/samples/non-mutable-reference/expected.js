import {
	SvelteComponent,
	detach,
	element,
	init,
	insert,
	noop,
	safe_not_equal
} from "svelte/internal";

function create_fragment(ctx) {
	let h1;

	return {
		c() {
			h1 = element("h1");
			h1.textContent = `Hello ${name}!`;
		},
		m(target, anchor) {
			insert(target, h1, anchor);
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(h1);
		}
	};
}

let name = "world";

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment, safe_not_equal, {});
	}
}

export default Component;
