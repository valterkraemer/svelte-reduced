import { custom_event } from './dom';

export let current_component;

export function set_current_component(component) {
	current_component = component;
}

export function get_current_component() {
	if (!current_component) throw new Error('Function called outside component initialization');
	return current_component;
}

export function onMount(fn) {
	get_current_component().$$.on_mount.push(fn);
}

export function onDestroy(fn) {
	get_current_component().$$.on_destroy.push(fn);
}

export function createEventDispatcher<
	EventMap extends {} = any
>(): <EventKey extends Extract<keyof EventMap, string>>(type: EventKey, detail?: EventMap[EventKey]) => void {
	const component = get_current_component();

	return (type: string, detail?: any) => {
		const callbacks = component.$$.callbacks[type];

		if (callbacks) {
			// TODO are there situations where events could be dispatched
			// in a server (non-DOM) environment?
			const event = custom_event(type, detail);
			callbacks.slice().forEach(fn => {
				fn.call(component, event);
			});
		}
	};
}

// TODO figure out if we still want to support
// shorthand events, or if we want to implement
// a real bubbling mechanism
export function bubble(component, event) {
	const callbacks = component.$$.callbacks[event.type];

	if (callbacks) {
		callbacks.slice().forEach(fn => fn(event));
	}
}
