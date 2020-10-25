import Wrapper from '../shared/Wrapper';
import BindingWrapper from '../Element/Binding';
import Renderer from '../../Renderer';
import Block from '../../Block';
import InlineComponent from '../../../nodes/InlineComponent';
import FragmentWrapper from '../Fragment';
import { sanitize } from '../../../../utils/names';
import { b, x, p } from 'code-red';
import Attribute from '../../../nodes/Attribute';
import bind_this from '../shared/bind_this';
import { Node, Identifier, ObjectExpression } from 'estree';
import EventHandler from '../Element/EventHandler';
import { string_to_member_expression } from '../../../utils/string_to_member_expression';

export default class InlineComponentWrapper extends Wrapper {
	var: Identifier;
	node: InlineComponent;
	fragment: FragmentWrapper;

	constructor(
		renderer: Renderer,
		block: Block,
		parent: Wrapper,
		node: InlineComponent
	) {
		super(renderer, block, parent, node);

		this.cannot_use_innerhtml();
		this.not_static_content();

		if (this.node.expression) {
			block.add_dependencies(this.node.expression.dependencies);
		}

		this.node.attributes.forEach(attr => {
			block.add_dependencies(attr.dependencies);
		});

		this.node.bindings.forEach(binding => {
			block.add_dependencies(binding.expression.dependencies);
		});

		this.node.handlers.forEach(handler => {
			if (handler.expression) {
				block.add_dependencies(handler.expression.dependencies);
			}
		});

		this.var = {
			type: 'Identifier',
			name: (
				sanitize(this.node.name)
			).toLowerCase()
		};
	}

	warn_if_reactive() {
		const { name } = this.node;
		const variable = this.renderer.component.var_lookup.get(name);
		if (!variable) {
			return;
		}

		if (variable.reassigned || variable.export_name || variable.is_reactive_dependency) {
			this.renderer.component.warn(this.node, {
				code: 'reactive-component',
				message: `<${name}/> will not be reactive if ${name} changes. Use <svelte:component this={${name}}/> if you want this reactivity.`
			});
		}
	}

	render(
		block: Block,
		parent_node: Identifier
	) {
		this.warn_if_reactive();

		const { renderer } = this;
		const { component } = renderer;

		const name = this.var;
		block.add_variable(name);

		const component_opts = x`{}` as ObjectExpression;

		const statements: Array<Node | Node[]> = [];
		const updates: Array<Node | Node[]> = [];

		if (this.fragment) {
			this.renderer.add_to_context('$$scope', true);
		}

		let props;
		const name_changes = block.get_unique_name(`${name.name}_changes`);

		const initial_props = [];

		const attribute_object = x`{
				${this.node.attributes.map(attr => p`${attr.name}: ${attr.get_value(block)}`)},
				${initial_props}
			}`;

		if (this.node.attributes.length || this.node.bindings.length || initial_props.length) {
			if (this.node.bindings.length === 0) {
				component_opts.properties.push(p`props: ${attribute_object}`);
			} else {
				props = block.get_unique_name(`${name.name}_props`);
				component_opts.properties.push(p`props: ${props}`);
			}
		}

		const fragment_dependencies = new Set(this.fragment ? ['$$scope'] : []);

		const dynamic_attributes = this.node.attributes.filter(a => a.get_dependencies().length > 0);

		if (dynamic_attributes.length > 0 || this.node.bindings.length > 0 || fragment_dependencies.size > 0) {
			updates.push(b`const ${name_changes} = {};`);
		}

		if (this.node.attributes.length) {
			dynamic_attributes.forEach((attribute: Attribute) => {
				const dependencies = attribute.get_dependencies();
				if (dependencies.length > 0) {
					const condition = renderer.dirty(dependencies);

					updates.push(b`
						if (${condition}) ${name_changes}.${attribute.name} = ${attribute.get_value(block)};
					`);
				}
			});
		}

		if (fragment_dependencies.size > 0) {
			updates.push(b`
				if (${renderer.dirty(Array.from(fragment_dependencies))}) {
					${name_changes}.$$scope = { dirty: #dirty, ctx: #ctx };
				}`);
		}

		const munged_bindings = this.node.bindings.map(binding => {
			component.has_reactive_assignments = true;

			if (binding.name === 'this') {
				return bind_this(component, block, new BindingWrapper(block, binding, this), this.var);
			}

			const id = component.get_unique_name(`${this.var.name}_${binding.name}_binding`);
			renderer.add_to_context(id.name);
			const callee = renderer.reference(id);

			const updating = block.get_unique_name(`updating_${binding.name}`);
			block.add_variable(updating);

			const snippet = binding.expression.manipulate(block);

			statements.push(b`
				if (${snippet} !== void 0) {
					${props}.${binding.name} = ${snippet};
				}`
			);

			updates.push(b`
				if (!${updating} && ${renderer.dirty(Array.from(binding.expression.dependencies))}) {
					${updating} = true;
					${name_changes}.${binding.name} = ${snippet};
					@add_flush_callback(() => ${updating} = false);
				}
			`);

			const contextual_dependencies = Array.from(binding.expression.contextual_dependencies);
			const dependencies = Array.from(binding.expression.dependencies);

			let lhs = binding.raw_expression;

			if (binding.is_contextual && binding.expression.node.type === 'Identifier') {
				// bind:x={y} — we can't just do `y = x`, we need to
				// to `array[index] = x;
				const { name } = binding.expression.node;
				const { object, property, snippet } = block.bindings.get(name);
				lhs = snippet;
				contextual_dependencies.push(object.name, property.name);
			}

			const params = [x`#value`];
			if (contextual_dependencies.length > 0) {
				const args = [];

				contextual_dependencies.forEach(name => {
					params.push({
						type: 'Identifier',
						name
					});

					renderer.add_to_context(name, true);
					args.push(renderer.reference(name));
				});


				block.chunks.init.push(b`
					function ${id}(#value) {
						${callee}.call(null, #value, ${args});
					}
				`);

				block.maintain_context = true; // TODO put this somewhere more logical
			} else {
				block.chunks.init.push(b`
					function ${id}(#value) {
						${callee}.call(null, #value);
					}
				`);
			}

			const body = b`
				function ${id}(${params}) {
					${lhs} = #value;
					${renderer.invalidate(dependencies[0])};
				}
			`;

			component.partly_hoisted.push(body);

			return b`@binding_callbacks.push(() => @bind(${this.var}, '${binding.name}', ${id}));`;
		});

		const munged_handlers = this.node.handlers.map(handler => {
			const event_handler = new EventHandler(handler, this);
			let snippet = event_handler.get_snippet(block);
			if (handler.modifiers.has('once')) snippet = x`@once(${snippet})`;

			return b`${name}.$on("${handler.name}", ${snippet});`;
		});

		const expression = this.renderer.reference(string_to_member_expression(this.node.name));

		block.chunks.init.push(b`
			${(this.node.attributes.length > 0 || this.node.bindings.length > 0) && b`
			${props && b`let ${props} = ${attribute_object};`}`}
			${statements}
			${name} = new ${expression}(${component_opts});

			${munged_bindings}
			${munged_handlers}
		`);

		block.chunks.create.push(b`@create_component(${name}.$$.fragment);`);

		block.chunks.mount.push(
			b`@mount_component(${name}, ${parent_node || '#target'}, ${parent_node ? 'null' : '#anchor'});`
		);

		if (updates.length) {
			block.chunks.update.push(b`
				${updates}
				${name}.$set(${name_changes});
			`);
		}

		block.chunks.destroy.push(b`
			@destroy_component(${name}, ${parent_node ? null : 'detaching'});
		`);
	}
}
