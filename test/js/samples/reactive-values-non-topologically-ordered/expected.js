import { SvelteComponent, init, safe_not_equal } from "svelte/internal";

function instance($$self, $$props, $$invalidate) {
	let { x } = $$props;
	let a;
	let b;

	$$self.$$set = $$props => {
		if ("x" in $$props) $$invalidate(0, x = $$props.x);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*x*/ 1) {
			$: $$invalidate(2, b = x);
		}

		if ($$self.$$.dirty & /*b*/ 4) {
			$: a = b;
		}
	};

	return [x];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, null, safe_not_equal, { x: 0 });
	}
}

export default Component;
