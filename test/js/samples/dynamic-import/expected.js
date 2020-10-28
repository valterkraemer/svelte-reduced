import {
	SvelteComponent,
	create_component,
	destroy_component,
	init,
	mount_component,
	noop,
	safe_not_equal
} from "svelte/internal";

import LazyLoad from "./LazyLoad.svelte";

function create_fragment(ctx) {
	let lazyload;
	lazyload = new LazyLoad({ props: { load: func } });

	return {
		c() {
			create_component(lazyload.$$.fragment);
		},
		m(target, anchor) {
			mount_component(lazyload, target, anchor);
		},
		p: noop,
		d(detaching) {
			destroy_component(lazyload, detaching);
		}
	};
}

const func = () => import("./Foo.svelte");

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment, safe_not_equal, {});
	}
}

export default Component;
