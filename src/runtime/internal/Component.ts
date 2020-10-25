import { add_render_callback, flush, schedule_update, dirty_components } from './scheduler';
import { current_component, set_current_component } from './lifecycle';
import { blank_object, is_empty, is_function, run, run_all, noop } from './utils';

interface Fragment {
	key: string|null;
	first: null;
	/* create  */ c: () => void;
	/* mount   */ m: (target: HTMLElement, anchor: any) => void;
	/* update  */ p: (ctx: any, dirty: any) => void;
	/* destroy */ d: (detaching: 0|1) => void;
}
interface T$$ {
	dirty: number[];
	ctx: null|any;
	bound: any;
	update: () => void;
	callbacks: any;
	props: Record<string, 0 | string>;
	fragment: null|false|Fragment;
	not_equal: any;
	on_mount: any[];
	on_destroy: any[];
	skip_bound: boolean;
}

export function bind(component, name, callback) {
	const index = component.$$.props[name];
	if (index !== undefined) {
		component.$$.bound[index] = callback;
		callback(component.$$.ctx[index]);
	}
}

export function create_component(block) {
	block && block.c();
}

export function mount_component(component, target, anchor) {
	const { fragment, on_mount, on_destroy } = component.$$;

	fragment && fragment.m(target, anchor);

	// onMount happens before the initial afterUpdate
	add_render_callback(() => {
		const new_on_destroy = on_mount.map(run).filter(is_function);
		if (on_destroy) {
			on_destroy.push(...new_on_destroy);
		} else {
			// Edge case - component was destroyed immediately,
			// most likely as a result of a binding initialising
			run_all(new_on_destroy);
		}
		component.$$.on_mount = [];
	});
}

export function destroy_component(component, detaching) {
	const $$ = component.$$;
	if ($$.fragment !== null) {
		run_all($$.on_destroy);

		$$.fragment && $$.fragment.d(detaching);

		// TODO null out other refs, including component.$$ (but need to
		// preserve final state?)
		$$.on_destroy = $$.fragment = null;
		$$.ctx = [];
	}
}

function make_dirty(component, i) {
	if (component.$$.dirty[0] === -1) {
		dirty_components.push(component);
		schedule_update();
		component.$$.dirty.fill(0);
	}
	component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}

export function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
	const parent_component = current_component;
	set_current_component(component);

	const prop_values = options.props || {};

	const $$: T$$ = component.$$ = {
		fragment: null,
		ctx: null,

		// state
		props,
		update: noop,
		not_equal,
		bound: blank_object(),

		// lifecycle
		on_mount: [],
		on_destroy: [],

		// everything else
		callbacks: blank_object(),
		dirty,
		skip_bound: false
	};

	let ready = false;

	$$.ctx = instance
		? instance(component, prop_values, (i, ret, ...rest) => {
			const value = rest.length ? rest[0] : ret;
			if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
				if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
				if (ready) make_dirty(component, i);
			}
			return ret;
		})
		: [];

	$$.update();
	ready = true;

	// `false` as a special case of no DOM component
	$$.fragment = create_fragment ? create_fragment($$.ctx) : false;

	if (options.target) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		$$.fragment && $$.fragment!.c();

		mount_component(component, options.target, options.anchor);
		flush();
	}

	set_current_component(parent_component);
}

export class SvelteComponent {
	$$: T$$;
	$$set?: ($$props: any) => void;

	$destroy() {
		destroy_component(this, 1);
		this.$destroy = noop;
	}

	$on(type, callback) {
		const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
		callbacks.push(callback);

		return () => {
			const index = callbacks.indexOf(callback);
			if (index !== -1) callbacks.splice(index, 1);
		};
	}

	$set($$props) {
		if (this.$$set && !is_empty($$props)) {
			this.$$.skip_bound = true;
			this.$$set($$props);
			this.$$.skip_bound = false;
		}
	}
}
