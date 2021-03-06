import {
	SvelteComponent,
	create_component,
	destroy_component,
	init,
	mount_component,
	noop,
	safe_not_equal
} from "svelte/internal";

function create_fragment(ctx) {
	let nested;
	nested = new /*Nested*/ ctx[0]({ props: { foo: [1, 2, 3] } });

	return {
		c() {
			create_component(nested.$$.fragment);
		},
		m(target, anchor) {
			mount_component(nested, target, anchor);
		},
		p: noop,
		d(detaching) {
			destroy_component(nested, detaching);
		}
	};
}

function instance($$self) {
	const Nested = window.Nested;
	return [Nested];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export default Component;
