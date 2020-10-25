import Renderer from '../../Renderer';
import Element from '../../../nodes/Element';
import Wrapper from '../shared/Wrapper';
import Block from '../../Block';
import { is_void } from '../../../../utils/names';
import FragmentWrapper from '../Fragment';
import { escape_html, string_literal } from '../../../utils/stringify';
import TextWrapper from '../Text';
import fix_attribute_casing from './fix_attribute_casing';
import { b, x, p } from 'code-red';
import { namespaces } from '../../../../utils/namespaces';
import AttributeWrapper from './Attribute';
import StyleAttributeWrapper from './StyleAttribute';
import { dimensions } from '../../../../utils/patterns';
import Binding from './Binding';
import add_to_set from '../../../utils/add_to_set';
import { add_event_handler } from '../shared/add_event_handlers';
import bind_this from '../shared/bind_this';
import { Identifier } from 'estree';
import EventHandler from './EventHandler';
import MustacheTagWrapper from '../MustacheTag';

interface BindingGroup {
	events: string[];
	bindings: Binding[];
}

const events = [
	{
		event_names: ['input'],
		filter: (node: Element, _name: string) =>
			node.name === 'textarea' ||
			node.name === 'input' && !/radio|checkbox|range|file/.test(node.get_static_attribute_value('type') as string)
	},
	{
		event_names: ['input'],
		filter: (node: Element, name: string) =>
			(name === 'textContent' || name === 'innerHTML') &&
			node.attributes.some(attribute => attribute.name === 'contenteditable')
	},
	{
		event_names: ['change'],
		filter: (node: Element, _name: string) =>
			node.name === 'select' ||
			node.name === 'input' && /radio|checkbox|file/.test(node.get_static_attribute_value('type') as string)
	},
	{
		event_names: ['change', 'input'],
		filter: (node: Element, _name: string) =>
			node.name === 'input' && node.get_static_attribute_value('type') === 'range'
	},

	{
		event_names: ['elementresize'],
		filter: (_node: Element, name: string) =>
			dimensions.test(name)
	},

	// media events
	{
		event_names: ['timeupdate'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			(name === 'currentTime' || name === 'played' || name === 'ended')
	},
	{
		event_names: ['durationchange'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			name === 'duration'
	},
	{
		event_names: ['play', 'pause'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			name === 'paused'
	},
	{
		event_names: ['progress'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			name === 'buffered'
	},
	{
		event_names: ['loadedmetadata'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			(name === 'buffered' || name === 'seekable')
	},
	{
		event_names: ['volumechange'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			(name === 'volume' || name === 'muted')
	},
	{
		event_names: ['ratechange'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			name === 'playbackRate'
	},
	{
		event_names: ['seeking', 'seeked'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			(name === 'seeking')
	},
	{
		event_names: ['ended'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			name === 'ended'
	},
	{
		event_names: ['resize'],
		filter: (node: Element, name: string) =>
			node.is_media_node() &&
			(name === 'videoHeight' || name === 'videoWidth')
	},

	// details event
	{
		event_names: ['toggle'],
		filter: (node: Element, _name: string) =>
			node.name === 'details'
	}
];

export default class ElementWrapper extends Wrapper {
	node: Element;
	fragment: FragmentWrapper;
	attributes: Array<AttributeWrapper | StyleAttributeWrapper>;
	bindings: Binding[];
	event_handlers: EventHandler[];
	class_dependencies: string[];

	select_binding_dependencies?: Set<string>;

	var: any;
	void: boolean;

	constructor(
		renderer: Renderer,
		block: Block,
		parent: Wrapper,
		node: Element,
		strip_whitespace: boolean,
		next_sibling: Wrapper
	) {
		super(renderer, block, parent, node);
		this.var = {
			type: 'Identifier',
			name: node.name.replace(/[^a-zA-Z0-9_$]/g, '_')
		};

		this.void = is_void(node.name);

		this.class_dependencies = [];

		this.attributes = this.node.attributes.map(attribute => {
			if (attribute.name === 'style') {
				return new StyleAttributeWrapper(this, block, attribute);
			}
			return new AttributeWrapper(this, block, attribute);
		});

		// ordinarily, there'll only be one... but we need to handle
		// the rare case where an element can have multiple bindings,
		// e.g. <audio bind:paused bind:currentTime>
		this.bindings = this.node.bindings.map(binding => new Binding(block, binding, this));

		this.event_handlers = this.node.handlers.map(event_handler => new EventHandler(event_handler, this));

		// add directive and handler dependencies
		[...node.classes].forEach(directive => {
			if (directive && directive.expression) {
				block.add_dependencies(directive.expression.dependencies);
			}
		});

		node.handlers.forEach(handler => {
			if (handler.expression) {
				block.add_dependencies(handler.expression.dependencies);
			}
		});

		if (this.parent) {
			if (node.bindings.length > 0 ||
				node.classes.length > 0 ||
				node.handlers.length > 0 ||
				this.node.name === 'option'
			) {
				this.parent.cannot_use_innerhtml(); // need to use add_location
				this.parent.not_static_content();
			}
		}

		this.fragment = new FragmentWrapper(renderer, block, node.children, this, strip_whitespace, next_sibling);
	}

	render(block: Block, parent_node: Identifier, parent_nodes: Identifier) {
		const { renderer } = this;

		if (this.node.name === 'noscript') return;

		const node = this.var;
		const nodes = parent_nodes && block.get_unique_name(`${this.var.name}_nodes`); // if we're in unclaimable territory, i.e. <head>, parent_nodes is null
		const children = x`@children(${this.node.name === 'template' ? x`${node}.content` : node})`;

		block.add_variable(node);
		const render_statement = this.get_render_statement();
		block.chunks.create.push(
			b`${node} = ${render_statement};`
		);

		if (renderer.options.hydratable) {
			if (parent_nodes) {
				block.chunks.claim.push(b`
					${node} = ${this.get_claim_statement(parent_nodes)};
				`);

				if (!this.void && this.node.children.length > 0) {
					block.chunks.claim.push(b`
						var ${nodes} = ${children};
					`);
				}
			} else {
				block.chunks.claim.push(
					b`${node} = ${render_statement};`
				);
			}
		}

		if (parent_node) {
			block.chunks.mount.push(
				b`@append(${parent_node}, ${node});`
			);
		} else {
			block.chunks.mount.push(b`@insert(#target, ${node}, #anchor);`);

			// TODO we eventually need to consider what happens to elements
			// that belong to the same outgroup as an outroing element...
			block.chunks.destroy.push(b`if (detaching) @detach(${node});`);
		}

		// insert static children with textContent or innerHTML
		const can_use_textcontent = this.can_use_textcontent();
		if (!this.node.namespace && (this.can_use_innerhtml || can_use_textcontent) && this.fragment.nodes.length > 0) {
			if (this.fragment.nodes.length === 1 && this.fragment.nodes[0].node.type === 'Text') {
				block.chunks.create.push(
					b`${node}.textContent = ${string_literal((this.fragment.nodes[0] as TextWrapper).data)};`
				);
			} else {
				const state = {
					quasi: {
						type: 'TemplateElement',
						value: { raw: '' }
					}
				};

				const literal = {
					type: 'TemplateLiteral',
					expressions: [],
					quasis: []
				};

				const can_use_raw_text = !this.can_use_innerhtml && can_use_textcontent;
				to_html((this.fragment.nodes as unknown as Array<ElementWrapper | TextWrapper>), block, literal, state, can_use_raw_text);
				literal.quasis.push(state.quasi);

				block.chunks.create.push(
					b`${node}.${this.can_use_innerhtml ? 'innerHTML': 'textContent'} = ${literal};`
				);
			}
		} else {
			this.fragment.nodes.forEach((child: Wrapper) => {
				child.render(
					block,
					this.node.name === 'template' ? x`${node}.content` : node,
					nodes
				);
			});
		}

		const event_handler_or_binding_uses_context = (
			this.bindings.some(binding => binding.handler.uses_context) ||
			this.node.handlers.some(handler => handler.uses_context)
		);

		if (event_handler_or_binding_uses_context) {
			block.maintain_context = true;
		}

		this.add_attributes(block);
		this.add_directives_in_order(block);
		this.add_classes(block);

		if (nodes && this.renderer.options.hydratable && !this.void) {
			block.chunks.claim.push(
				b`${this.node.children.length > 0 ? nodes : children}.forEach(@detach);`
			);
		}
	}

	can_use_textcontent() {
		return this.is_static_content && this.fragment.nodes.every(node => node.node.type === 'Text' || node.node.type === 'MustacheTag');
	}

	get_render_statement() {
		const { name, namespace } = this.node;

		if (namespace === namespaces.svg) {
			return x`@svg_element("${name}")`;
		}

		if (namespace) {
			return x`@_document.createElementNS("${namespace}", "${name}")`;
		}

		return x`@element("${name}")`;
	}

	get_claim_statement(nodes: Identifier) {
		const attributes = this.node.attributes
			.filter((attr) => attr.type === 'Attribute')
			.map((attr) => p`${attr.name}: true`);

		const name = this.node.namespace
			? this.node.name
			: this.node.name.toUpperCase();

		const svg = this.node.namespace === namespaces.svg ? 1 : null;

		return x`@claim_element(${nodes}, "${name}", { ${attributes} }, ${svg})`;
	}

	add_directives_in_order (block: Block) {
		type OrderedAttribute = EventHandler | BindingGroup | Binding;

		const binding_groups = events
			.map(event => ({
				events: event.event_names,
				bindings: this.bindings
					.filter(binding => binding.node.name !== 'this')
					.filter(binding => event.filter(this.node, binding.node.name))
			}))
			.filter(group => group.bindings.length);

		const this_binding = this.bindings.find(b => b.node.name === 'this');

		function getOrder (item: OrderedAttribute) {
			if (item instanceof EventHandler) {
				return item.node.start;
			} else if (item instanceof Binding) {
				return item.node.start;
			} else {
				return item.bindings[0].node.start;
			}
		}

		([
			...binding_groups,
			...this.event_handlers,
			this_binding
		] as OrderedAttribute[])
			.filter(Boolean)
			.sort((a, b) => getOrder(a) - getOrder(b))
			.forEach(item => {
				if (item instanceof EventHandler) {
					add_event_handler(block, this.var, item);
				} else if (item instanceof Binding) {
					this.add_this_binding(block, item);
				} else {
					this.add_bindings(block, item);
				}
			});
	}

	add_bindings(block: Block, binding_group: BindingGroup) {
		const { renderer } = this;

		if (binding_group.bindings.length === 0) return;

		renderer.component.has_reactive_assignments = true;

		const lock = binding_group.bindings.some(binding => binding.needs_lock) ?
			block.get_unique_name(`${this.var.name}_updating`) :
			null;

		if (lock) block.add_variable(lock, x`false`);

		const handler = renderer.component.get_unique_name(`${this.var.name}_${binding_group.events.join('_')}_handler`);
		renderer.add_to_context(handler.name);

		// TODO figure out how to handle locks
		const needs_lock = binding_group.bindings.some(binding => binding.needs_lock);

		const dependencies: Set<string> = new Set();
		const contextual_dependencies: Set<string> = new Set();

		binding_group.bindings.forEach(binding => {
			// TODO this is a mess
			add_to_set(dependencies, binding.get_dependencies());
			add_to_set(contextual_dependencies, binding.handler.contextual_dependencies);

			binding.render(block, lock);
		});

		// media bindings — awkward special case. The native timeupdate events
		// fire too infrequently, so we need to take matters into our
		// own hands
		let animation_frame;
		if (binding_group.events[0] === 'timeupdate') {
			animation_frame = block.get_unique_name(`${this.var.name}_animationframe`);
			block.add_variable(animation_frame);
		}

		const has_local_function = contextual_dependencies.size > 0 || needs_lock || animation_frame;

		let callee = renderer.reference(handler);

		// TODO dry this out — similar code for event handlers and component bindings
		if (has_local_function) {
			const args = Array.from(contextual_dependencies).map(name => renderer.reference(name));

			// need to create a block-local function that calls an instance-level function
			if (animation_frame) {
				block.chunks.init.push(b`
					function ${handler}() {
						@_cancelAnimationFrame(${animation_frame});
						if (!${this.var}.paused) {
							${animation_frame} = @raf(${handler});
							${needs_lock && b`${lock} = true;`}
						}
						${callee}.call(${this.var}, ${args});
					}
				`);
			} else {
				block.chunks.init.push(b`
					function ${handler}() {
						${needs_lock && b`${lock} = true;`}
						${callee}.call(${this.var}, ${args});
					}
				`);
			}

			callee = handler;
		}

		const params = Array.from(contextual_dependencies).map(name => ({
			type: 'Identifier',
			name
		}));

		this.renderer.component.partly_hoisted.push(b`
			function ${handler}(${params}) {
				${binding_group.bindings.map(b => b.handler.mutation)}
				${Array.from(dependencies)
					.filter(dep => dep[0] !== '$')
					.filter(dep => !contextual_dependencies.has(dep))
					.map(dep => b`${this.renderer.invalidate(dep)};`)}
			}
		`);

		binding_group.events.forEach(name => {
			if (name === 'elementresize') {
				// special case
				const resize_listener = block.get_unique_name(`${this.var.name}_resize_listener`);
				block.add_variable(resize_listener);

				block.chunks.mount.push(
					b`${resize_listener} = @add_resize_listener(${this.var}, ${callee}.bind(${this.var}));`
				);

				block.chunks.destroy.push(
					b`${resize_listener}();`
				);
			} else {
				block.event_listeners.push(
					x`@listen(${this.var}, "${name}", ${callee})`
				);
			}
		});

		const some_initial_state_is_undefined = binding_group.bindings
			.map(binding => x`${binding.snippet} === void 0`)
			.reduce((lhs, rhs) => x`${lhs} || ${rhs}`);

		const should_initialise = (
			this.node.name === 'select' ||
			binding_group.bindings.find(binding => {
				return (
					binding.node.name === 'indeterminate' ||
					binding.node.name === 'textContent' ||
					binding.node.name === 'innerHTML' ||
					binding.is_readonly_media_attribute()
				);
			})
		);

		if (should_initialise) {
			const callback = has_local_function ? handler : x`() => ${callee}.call(${this.var})`;
			block.chunks.hydrate.push(
				b`if (${some_initial_state_is_undefined}) @add_render_callback(${callback});`
			);
		}

		if (binding_group.events[0] === 'elementresize') {
			block.chunks.hydrate.push(
				b`@add_render_callback(() => ${callee}.call(${this.var}));`
			);
		}

		if (lock) {
			block.chunks.update.push(b`${lock} = false;`);
		}
	}

	add_this_binding(block: Block, this_binding: Binding) {
		const { renderer } = this;

		renderer.component.has_reactive_assignments = true;

		const binding_callback = bind_this(renderer.component, block, this_binding, this.var);
		block.chunks.mount.push(binding_callback);
	}

	add_attributes(block: Block) {
		// Get all the class dependencies first
		this.attributes.forEach((attribute) => {
			if (attribute.node.name === 'class') {
				const dependencies = attribute.node.get_dependencies();
				this.class_dependencies.push(...dependencies);
			}
		});

		this.attributes.forEach((attribute) => {
			attribute.render(block);
		});
	}

	add_classes(block: Block) {
		this.node.classes.forEach(class_directive => {
			const { expression, name } = class_directive;
			let snippet;
			let dependencies;
			if (expression) {
				snippet = expression.manipulate(block);
				dependencies = expression.dependencies;
			} else {
				snippet = name;
				dependencies = new Set([name]);
			}
			const updater = b`@toggle_class(${this.var}, "${name}", ${snippet});`;

			block.chunks.hydrate.push(updater);

			if ((dependencies && dependencies.size > 0) || this.class_dependencies.length) {
				const all_dependencies = this.class_dependencies.concat(...dependencies);
				const condition = block.renderer.dirty(all_dependencies);

				block.chunks.update.push(b`
					if (${condition}) {
						${updater}
					}`);
			}
		});
	}
}

function to_html(wrappers: Array<ElementWrapper | TextWrapper | MustacheTagWrapper>, block: Block, literal: any, state: any, can_use_raw_text?: boolean) {
	wrappers.forEach(wrapper => {
		if (wrapper instanceof TextWrapper) {
			if ((wrapper as TextWrapper).use_space()) state.quasi.value.raw += ' ';

			const parent = wrapper.node.parent as Element;

			const raw = parent && (
				parent.name === 'script' ||
				parent.name === 'style' ||
				can_use_raw_text
			);

			state.quasi.value.raw += (raw ? wrapper.data : escape_html(wrapper.data))
				.replace(/\\/g, '\\\\')
				.replace(/`/g, '\\`')
				.replace(/\$/g, '\\$');
		}

		else if (wrapper instanceof MustacheTagWrapper) {
			literal.quasis.push(state.quasi);
			literal.expressions.push(wrapper.node.expression.manipulate(block));
			state.quasi = {
				type: 'TemplateElement',
				value: { raw: '' }
			};
		}

		else if (wrapper.node.name === 'noscript') {
			// do nothing
		}

		else {
			// element
			state.quasi.value.raw += `<${wrapper.node.name}`;

			(wrapper as ElementWrapper).attributes.forEach((attr: AttributeWrapper) => {
				state.quasi.value.raw += ` ${fix_attribute_casing(attr.node.name)}="`;

				attr.node.chunks.forEach(chunk => {
					if (chunk.type === 'Text') {
						state.quasi.value.raw += escape_html(chunk.data);
					} else {
						literal.quasis.push(state.quasi);
						literal.expressions.push(chunk.manipulate(block));

						state.quasi = {
							type: 'TemplateElement',
							value: { raw: '' }
						};
					}
				});

				state.quasi.value.raw += '"';
			});

			if (!wrapper.void) {
				state.quasi.value.raw += '>';

				to_html(wrapper.fragment.nodes as Array<ElementWrapper | TextWrapper>, block, literal, state);

				state.quasi.value.raw += `</${wrapper.node.name}>`;
			} else {
				state.quasi.value.raw += '/>';
			}
		}
	});
}
