import {
	SvelteComponent,
	add_render_callback,
	init,
	listen,
	noop,
	run_all,
	safe_not_equal
} from "svelte/internal";

function create_fragment(ctx) {
	let mounted;
	let dispose;
	add_render_callback(/*onlinestatuschanged*/ ctx[1]);

	return {
		c: noop,
		m(target, anchor) {
			if (!mounted) {
				dispose = [
					listen(window, "online", /*onlinestatuschanged*/ ctx[1]),
					listen(window, "offline", /*onlinestatuschanged*/ ctx[1])
				];

				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let online;

	function onlinestatuschanged() {
		$$invalidate(0, online = navigator.onLine);
	}

	return [online, onlinestatuschanged];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export default Component;
