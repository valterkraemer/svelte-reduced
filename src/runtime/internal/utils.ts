export function noop() {}

export function assign<T, S>(tar: T, src: S): T & S {
	// @ts-ignore
	for (const k in src) tar[k] = src[k];
	return tar as T & S;
}

export function run(fn) {
	return fn();
}

export function blank_object() {
	return Object.create(null);
}

export function run_all(fns) {
	fns.forEach(run);
}

export function is_function(thing: any): thing is Function {
	return typeof thing === 'function';
}

export function safe_not_equal(a, b) {
	return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}

export function is_empty(obj) {
	return Object.keys(obj).length === 0;
}

export function exclude_internal_props(props) {
	const result = {};
	for (const k in props) if (k[0] !== '$') result[k] = props[k];
	return result;
}

export function null_to_empty(value) {
	return value == null ? '' : value;
}
