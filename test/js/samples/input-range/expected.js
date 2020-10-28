import {
	SvelteComponent,
	attr,
	detach,
	element,
	init,
	insert,
	listen,
	run_all,
	safe_not_equal,
	set_input_value,
	to_number
} from "svelte/internal";

function create_fragment(ctx) {
	let input;
	let mounted;
	let dispose;

	return {
		c() {
			input = element("input");
			attr(input, "type", "range");
		},
		m(target, anchor) {
			insert(target, input, anchor);
			set_input_value(input, /*value*/ ctx[0]);

			if (!mounted) {
				dispose = [
					listen(input, "change", /*input_change_input_handler*/ ctx[1]),
					listen(input, "input", /*input_change_input_handler*/ ctx[1])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*value*/ 1) {
				set_input_value(input, /*value*/ ctx[0]);
			}
		},
		d(detaching) {
			if (detaching) detach(input);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { value } = $$props;

	function input_change_input_handler() {
		value = to_number(this.value);
		$$invalidate(0, value);
	}

	$$self.$$set = $$props => {
		if ("value" in $$props) $$invalidate(0, value = $$props.value);
	};

	return [value, input_change_input_handler];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { value: 0 });
	}
}

export default Component;
