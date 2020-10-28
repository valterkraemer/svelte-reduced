import {
	SvelteComponent,
	attr,
	detach,
	element,
	init,
	insert,
	listen,
	noop,
	safe_not_equal
} from "svelte/internal";

function create_fragment(ctx) {
	let a;
	let mounted;
	let dispose;

	return {
		c() {
			a = element("a");
			a.textContent = "this should not navigate to example.com";
			attr(a, "href", "https://example.com");
		},
		m(target, anchor) {
			insert(target, a, anchor);

			if (!mounted) {
				dispose = listen(a, "touchstart", touchstart_handler);
				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(a);
			mounted = false;
			dispose();
		}
	};
}

const touchstart_handler = e => e.preventDefault();

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, null, create_fragment, safe_not_equal, {});
	}
}

export default Component;
