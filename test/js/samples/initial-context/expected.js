/* generated by Svelte vX.Y.Z */
import {
	SvelteComponent,
	detach,
	element,
	init,
	insert,
	listen,
	noop,
	safe_not_equal
} from "svelte/internal";

function create_fragment(ctx) {
	let button;
	let mounted;
	let dispose;

	return {
		c() {
			button = element("button");
		},
		m(target, anchor) {
			insert(target, button, anchor);

			if (!mounted) {
				dispose = listen(button, "click", /*click_handler*/ ctx[1]);
				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let foo;

	function unreferenced() {
		$$invalidate(0, foo = 1);
	}

	const click_handler = () => $$invalidate(0, foo = 2);
	return [foo, click_handler];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export default Component;
