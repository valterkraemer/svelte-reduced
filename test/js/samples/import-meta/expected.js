import {
	SvelteComponent,
	detach,
	init,
	insert,
	noop,
	safe_not_equal,
	space,
	text
} from "svelte/internal";

function create_fragment(ctx) {
	let t0;
	let t1;
	let t2_value = import.meta.url + "";
	let t2;

	return {
		c() {
			t0 = text(/*url*/ ctx[0]);
			t1 = space();
			t2 = text(t2_value);
		},
		m(target, anchor) {
			insert(target, t0, anchor);
			insert(target, t1, anchor);
			insert(target, t2, anchor);
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(t0);
			if (detaching) detach(t1);
			if (detaching) detach(t2);
		}
	};
}

function instance($$self) {
	const url = import.meta.url;
	return [url];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export default Component;
