import {
	SvelteComponent,
	attr,
	detach,
	element,
	init,
	insert,
	listen,
	noop,
	run_all,
	safe_not_equal,
	space
} from "svelte/internal";

function create_fragment(ctx) {
	let input0;
	let t;
	let input1;
	let mounted;
	let dispose;

	return {
		c() {
			input0 = element("input");
			t = space();
			input1 = element("input");
			attr(input0, "type", "file");
			attr(input1, "type", "file");
		},
		m(target, anchor) {
			insert(target, input0, anchor);
			insert(target, t, anchor);
			insert(target, input1, anchor);

			if (!mounted) {
				dispose = [
					listen(input0, "change", /*input0_change_handler*/ ctx[1]),
					listen(input1, "change", /*input1_change_handler*/ ctx[2])
				];

				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(input0);
			if (detaching) detach(t);
			if (detaching) detach(input1);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { files } = $$props;

	function input0_change_handler() {
		files = this.files;
		$$invalidate(0, files);
	}

	function input1_change_handler() {
		files = this.files;
		$$invalidate(0, files);
	}

	$$self.$$set = $$props => {
		if ("files" in $$props) $$invalidate(0, files = $$props.files);
	};

	return [files, input0_change_handler, input1_change_handler];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { files: 0 });
	}
}

export default Component;
