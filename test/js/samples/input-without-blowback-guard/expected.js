import {
	SvelteComponent,
	attr,
	detach,
	element,
	init,
	insert,
	listen,
	safe_not_equal
} from "svelte/internal";

function create_fragment(ctx) {
	let input;
	let mounted;
	let dispose;

	return {
		c() {
			input = element("input");
			attr(input, "type", "checkbox");
		},
		m(target, anchor) {
			insert(target, input, anchor);
			input.checked = /*foo*/ ctx[0];

			if (!mounted) {
				dispose = listen(input, "change", /*input_change_handler*/ ctx[1]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*foo*/ 1) {
				input.checked = /*foo*/ ctx[0];
			}
		},
		d(detaching) {
			if (detaching) detach(input);
			mounted = false;
			dispose();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { foo } = $$props;

	function input_change_handler() {
		foo = this.checked;
		$$invalidate(0, foo);
	}

	$$self.$$set = $$props => {
		if ("foo" in $$props) $$invalidate(0, foo = $$props.foo);
	};

	return [foo, input_change_handler];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { foo: 0 });
	}
}

export default Component;
