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
	let input;
	let mounted;
	let dispose;

	return {
		c() {
			input = element("input");
			attr(input, "type", "file");
			input.multiple = true;
		},
		m(target, anchor) {
			insert(target, input, anchor);

			if (!mounted) {
				dispose = listen(input, "change", /*input_change_handler*/ ctx[1]);
				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(input);
			mounted = false;
			dispose();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { files } = $$props;

	function input_change_handler() {
		files = this.files;
		$$invalidate(0, files);
	}

	$$self.$$set = $$props => {
		if ("files" in $$props) $$invalidate(0, files = $$props.files);
	};

	return [files, input_change_handler];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { files: 0 });
	}
}

export default Component;
