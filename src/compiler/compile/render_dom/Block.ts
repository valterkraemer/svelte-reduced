import Renderer from './Renderer';
import Wrapper from './wrappers/shared/Wrapper';
import { b, x } from 'code-red';
import { Node, Identifier, ArrayPattern } from 'estree';

export interface Bindings {
	object: Identifier;
	property: Identifier;
	snippet: Node;
	tail: Node;
	modifier: (node: Node) => Node;
}

export interface BlockOptions {
	parent?: Block;
	name: Identifier;
	type: string;
	renderer?: Renderer;
	key?: Identifier;
	bindings?: Map<string, Bindings>;
	dependencies?: Set<string>;
}

export default class Block {
	parent?: Block;
	renderer: Renderer;
	name: Identifier;
	type: string;

	wrappers: Wrapper[];

	key: Identifier;
	first: Identifier;

	dependencies: Set<string> = new Set();

	bindings: Map<string, Bindings>;

	chunks: {
		declarations: Array<Node | Node[]>;
		init: Array<Node | Node[]>;
		create: Array<Node | Node[]>;
		hydrate: Array<Node | Node[]>;
		mount: Array<Node | Node[]>;
		update: Array<Node | Node[]>;
		destroy: Array<Node | Node[]>;
	};

	event_listeners: Node[] = [];

	maintain_context: boolean;

	aliases: Map<string, Identifier>;
	variables: Map<string, { id: Identifier; init?: Node }> = new Map();
	get_unique_name: (name: string) => Identifier;

	has_update_method = false;
	autofocus: string;

	constructor(options: BlockOptions) {
		this.parent = options.parent;
		this.renderer = options.renderer;
		this.name = options.name;
		this.type = options.type;

		this.wrappers = [];

		// for keyed each blocks
		this.key = options.key;
		this.first = null;

		this.bindings = options.bindings;

		this.chunks = {
			declarations: [],
			init: [],
			create: [],
			hydrate: [],
			mount: [],
			update: [],
			destroy: []
		};

		this.get_unique_name = this.renderer.component.get_unique_name_maker();

		this.aliases = new Map();
		if (this.key) this.aliases.set('key', this.get_unique_name('key'));
	}

	assign_variable_names() {
		const seen: Set<string> = new Set();
		const dupes: Set<string> = new Set();

		let i = this.wrappers.length;

		while (i--) {
			const wrapper = this.wrappers[i];

			if (!wrapper.var) continue;

			if (seen.has(wrapper.var.name)) {
				dupes.add(wrapper.var.name);
			}

			seen.add(wrapper.var.name);
		}

		const counts = new Map();
		i = this.wrappers.length;

		while (i--) {
			const wrapper = this.wrappers[i];

			if (!wrapper.var) continue;

			let suffix = '';
			if (dupes.has(wrapper.var.name)) {
				const i = counts.get(wrapper.var.name) || 0;
				counts.set(wrapper.var.name, i + 1);
				suffix = i;
			}
			wrapper.var.name = this.get_unique_name(wrapper.var.name + suffix).name;
		}
	}

	add_dependencies(dependencies: Set<string>) {
		dependencies.forEach(dependency => {
			this.dependencies.add(dependency);
		});

		this.has_update_method = true;
		if (this.parent) {
			this.parent.add_dependencies(dependencies);
		}
	}

	add_element(
		id: Identifier,
		render_statement: Node,
		parent_node: Node,
		no_detach?: boolean
	) {
		this.add_variable(id);
		this.chunks.create.push(b`${id} = ${render_statement};`);

		if (parent_node) {
			this.chunks.mount.push(b`@append(${parent_node}, ${id});`);
		} else {
			this.chunks.mount.push(b`@insert(#target, ${id}, #anchor);`);
			if (!no_detach) this.chunks.destroy.push(b`if (detaching) @detach(${id});`);
		}
	}

	add_variable(id: Identifier, init?: Node) {
		if (this.variables.has(id.name)) {
			throw new Error(
				`Variable '${id.name}' already initialised with a different value`
			);
		}

		this.variables.set(id.name, { id, init });
	}

	alias(name: string) {
		if (!this.aliases.has(name)) {
			this.aliases.set(name, this.get_unique_name(name));
		}

		return this.aliases.get(name);
	}

	child(options: BlockOptions) {
		return new Block(Object.assign({}, this, { key: null }, options, { parent: this }));
	}

	get_contents(key?: any) {
		if (this.autofocus) {
			this.chunks.mount.push(b`${this.autofocus}.focus();`);
		}

		this.render_listeners();

		const properties: Record<string, any> = {};

		const noop = x`@noop`;

		properties.key = key;

		if (this.first) {
			properties.first = x`null`;
			this.chunks.hydrate.push(b`this.first = ${this.first};`);
		}

		if (this.chunks.create.length === 0 && this.chunks.hydrate.length === 0) {
			properties.create = noop;
		} else {
			const hydrate = this.chunks.hydrate;

			properties.create = x`function #create() {
				${this.chunks.create}
				${hydrate}
			}`;
		}

		if (this.chunks.mount.length === 0) {
			properties.mount = noop;
		} else if (this.event_listeners.length === 0) {
			properties.mount = x`function #mount(#target, #anchor) {
				${this.chunks.mount}
			}`;
		} else {
			properties.mount = x`function #mount(#target, #anchor) {
				${this.chunks.mount}
			}`;
		}

		if (this.has_update_method || this.maintain_context) {
			if (this.chunks.update.length === 0 && !this.maintain_context) {
				properties.update = noop;
			} else {
				const ctx = this.maintain_context ? x`#new_ctx` : x`#ctx`;

				let dirty: Identifier | ArrayPattern = { type: 'Identifier', name: '#dirty' };
				if (!this.renderer.context_overflow && !this.parent) {
					dirty = { type: 'ArrayPattern', elements: [dirty] };
				}

				properties.update = x`function #update(${ctx}, ${dirty}) {
					${this.maintain_context && b`#ctx = ${ctx};`}
					${this.chunks.update}
				}`;
			}
		}

		if (this.chunks.destroy.length === 0) {
			properties.destroy = noop;
		} else {
			properties.destroy = x`function #destroy(detaching) {
				${this.chunks.destroy}
			}`;
		}

		for (const name in properties) {
			const property = properties[name];
			if (property) property.id = null;
		}

		const return_value: any = x`{
			key: ${properties.key},
			first: ${properties.first},
			c: ${properties.create},
			m: ${properties.mount},
			p: ${properties.update},
			d: ${properties.destroy}
		}`;

		const body = b`
			${this.chunks.declarations}

			${Array.from(this.variables.values()).map(({ id, init }) => {
				return init
					? b`let ${id} = ${init}`
					: b`let ${id}`;
			})}

			${this.chunks.init}

			${b`
					return ${return_value};`
			}
		`;

		return body;
	}

	has_content(): boolean {
		return !!this.first ||
			this.event_listeners.length > 0 ||
			this.chunks.create.length > 0 ||
			this.chunks.hydrate.length > 0 ||
			this.chunks.mount.length > 0 ||
			this.chunks.update.length > 0 ||
			this.chunks.destroy.length > 0;
	}

	render() {
		const key = this.key && this.get_unique_name('key');

		const args: any[] = [x`#ctx`];
		if (key) args.unshift(key);

		const fn = b`function ${this.name}(${args}) {
			${this.get_contents(key)}
		}`;

		return fn;
	}

	render_listeners(chunk: string = '') {
		if (this.event_listeners.length > 0) {
			this.add_variable({ type: 'Identifier', name: '#mounted' });
			this.chunks.destroy.push(b`#mounted = false`);

			const dispose: Identifier = {
				type: 'Identifier',
				name: `#dispose${chunk}`
			};

			this.add_variable(dispose);

			if (this.event_listeners.length === 1) {
				this.chunks.mount.push(
					b`
						if (!#mounted) {
							${dispose} = ${this.event_listeners[0]};
							#mounted = true;
						}
					`
				);

				this.chunks.destroy.push(
					b`${dispose}();`
				);
			} else {
				this.chunks.mount.push(b`
					if (!#mounted) {
						${dispose} = [
							${this.event_listeners}
						];
						#mounted = true;
					}
				`);

				this.chunks.destroy.push(
					b`@run_all(${dispose});`
				);
			}
		}
	}
}
