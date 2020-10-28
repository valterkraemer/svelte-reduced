export let now: () => number =  () => window.performance.now();

export let raf = cb => requestAnimationFrame(cb);

// used internally for testing
export function set_now(fn) {
	now = fn;
}

export function set_raf(fn) {
	raf = fn;
}
