import {
	SvelteComponent,
	append,
	detach,
	element,
	init,
	insert,
	listen,
	safe_not_equal,
	set_data,
	space,
	text
} from "svelte/internal";

function create_fragment(ctx) {
	let button;
	let t1;
	let p;
	let t2;
	let t3;
	let mounted;
	let dispose;

	return {
		c() {
			button = element("button");
			button.textContent = "foo";
			t1 = space();
			p = element("p");
			t2 = text("x: ");
			t3 = text(/*x*/ ctx[0]);
		},
		m(target, anchor) {
			insert(target, button, anchor);
			insert(target, t1, anchor);
			insert(target, p, anchor);
			append(p, t2);
			append(p, t3);

			if (!mounted) {
				dispose = listen(button, "click", /*foo*/ ctx[1]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*x*/ 1) set_data(t3, /*x*/ ctx[0]);
		},
		d(detaching) {
			if (detaching) detach(button);
			if (detaching) detach(t1);
			if (detaching) detach(p);
			mounted = false;
			dispose();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let x = 0;

	function foo() {
		if (true) $$invalidate(0, x += 1);
	}

	return [x, foo];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export default Component;
