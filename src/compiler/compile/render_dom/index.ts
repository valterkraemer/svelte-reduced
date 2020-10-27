import { b, x, p } from 'code-red';
import Component from '../Component';
import Renderer from './Renderer';
import { CompileOptions, CssResult } from '../../interfaces';
import { walk } from 'estree-walker';
import { extract_names, Scope } from '../utils/scope';
import { invalidate } from './invalidate';
import Block from './Block';
import { ClassDeclaration, Node, Statement, ObjectExpression, Expression } from 'estree';

export default function dom(
	component: Component,
	options: CompileOptions
): { js: Node[]; css: CssResult } {
	const { name } = component;

	const renderer = new Renderer(component, options);
	const { block } = renderer;

	const body = [];

	const css = component.stylesheet.render(true);
	const styles = css.code;

	const add_css = component.get_unique_name('add_css');

	const should_add_css = (
		!!styles &&
		options.css !== false
	);

	if (should_add_css) {
		body.push(b`
			function ${add_css}() {
				var style = @element("style");
				style.id = "${component.stylesheet.id}-style";
				style.textContent = "${styles}";
				@append(@_document.head, style);
			}
		`);
	}

	// fix order
	// TODO the deconflicted names of blocks are reversed... should set them here
	const blocks = renderer.blocks.slice().reverse();

	body.push(...blocks.map(block => {
		// TODO this is a horrible mess — renderer.blocks
		// contains a mixture of Blocks and Nodes
		if ((block as Block).render) return (block as Block).render();
		return block;
	}));

	const uses_props = component.var_lookup.has('$$props');
	const $$props = uses_props ? '$$new_props' : '$$props';
	const props = component.vars.filter(variable => !variable.module && variable.export_name);
	const writable_props = props.filter(variable => variable.writable);

	const set = (uses_props || writable_props.length > 0)
		? x`
			${$$props} => {
				${uses_props && renderer.invalidate('$$props', x`$$props = @assign(@assign({}, $$props), @exclude_internal_props($$new_props))`)}
				${writable_props.map(prop =>
					b`if ('${prop.export_name}' in ${$$props}) ${renderer.invalidate(prop.name, x`${prop.name} = ${$$props}.${prop.export_name}`)};`
				)}
			}
		`
		: null;

	const accessors = [];

	const not_equal = x`@safe_not_equal`;
	let inject_state: Expression;
	let capture_state: Expression;
	let props_inject: Node[] | Node;

	props.forEach(prop => {
		const variable = component.var_lookup.get(prop.name);

		if (!variable.writable || component.component_options.accessors) {
			accessors.push({
				type: 'MethodDefinition',
				kind: 'get',
				key: { type: 'Identifier', name: prop.export_name },
				value: x`function() {
					return ${prop.hoistable ? prop.name : x`this.$$.ctx[${renderer.context_lookup.get(prop.name).index}]`}
				}`
			});
		}

		if (component.component_options.accessors) {
			if (variable.writable && !renderer.readonly.has(prop.name)) {
				accessors.push({
					type: 'MethodDefinition',
					kind: 'set',
					key: { type: 'Identifier', name: prop.export_name },
					value: x`function(${prop.name}) {
						this.$set({ ${prop.export_name}: ${prop.name} });
						@flush();
					}`
				});
			}
		}
	});

	// instrument assignments
	if (component.ast.instance) {
		let scope = component.instance_scope;
		const map = component.instance_scope_map;
		let execution_context: Node | null = null;

		walk(component.ast.instance.content, {
			enter(node: Node) {
				if (map.has(node)) {
					scope = map.get(node) as Scope;

					if (!execution_context && !scope.block) {
						execution_context = node;
					}
				} else if (!execution_context && node.type === 'LabeledStatement' && node.label.name === '$') {
					execution_context = node;
				}
			},

			leave(node: Node) {
				if (map.has(node)) {
					scope = scope.parent;
				}

				if (execution_context === node) {
					execution_context = null;
				}

				if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
					const assignee = node.type === 'AssignmentExpression' ? node.left : node.argument;

					// normally (`a = 1`, `b.c = 2`), there'll be a single name
					// (a or b). In destructuring cases (`[d, e] = [e, d]`) there
					// may be more, in which case we need to tack the extra ones
					// onto the initial function call
					const names = new Set(extract_names(assignee));

					this.replace(invalidate(renderer, scope, node, names, execution_context === null));
				}
			}
		});

		component.rewrite_props();
	}

	const args = [x`$$self`];
	const has_invalidate = props.length > 0 ||
		component.has_reactive_assignments ||
		capture_state ||
		inject_state;
	if (has_invalidate) {
		args.push(x`$$props`, x`$$invalidate`);
	}

	const has_create_fragment = block.has_content();
	if (has_create_fragment) {
		body.push(b`
			function create_fragment(#ctx) {
				${block.get_contents()}
			}
		`);
	}

	body.push(b`
		${component.extract_javascript(component.ast.module)}

		${component.fully_hoisted}
	`);

	const filtered_props = props.filter(prop => {
		const variable = component.var_lookup.get(prop.name);

		if (variable.hoistable) return false;
		return prop.name[0] !== '$';
	});

	const instance_javascript = component.extract_javascript(component.ast.instance);

	const has_definition = (
		(instance_javascript && instance_javascript.length > 0) ||
		filtered_props.length > 0 ||
		uses_props ||
		component.partly_hoisted.length > 0 ||
		renderer.initial_context.length > 0 ||
		component.reactive_declarations.length > 0 ||
		capture_state ||
		inject_state
	);

	const definition = has_definition
		? component.alias('instance')
		: { type: 'Literal', value: null };

	if (has_definition) {
		const reactive_declarations: (Node | Node[]) = [];
		const fixed_reactive_declarations = []; // not really 'reactive' but whatever

		component.reactive_declarations.forEach(d => {
			const dependencies = Array.from(d.dependencies);
			const uses_props = !!dependencies.find(n => n === '$$props');

			const writable = dependencies.filter(n => {
				const variable = component.var_lookup.get(n);
				return variable && (variable.export_name || variable.mutated || variable.reassigned);
			});

			const condition = !uses_props && writable.length > 0 && renderer.dirty(writable, true);

			let statement = d.node; // TODO remove label (use d.node.body) if it's not referenced

			if (condition) statement = b`if (${condition}) { ${statement} }`[0] as Statement;

			if (condition || uses_props) {
				reactive_declarations.push(statement);
			} else {
				fixed_reactive_declarations.push(statement);
			}
		});

		const injected = Array.from(component.injected_reactive_declaration_vars).filter(name => {
			const variable = component.var_lookup.get(name);
			return variable.injected && variable.name[0] !== '$';
		});

		let unknown_props_check;

		const return_value = {
			type: 'ArrayExpression',
			elements: renderer.initial_context.map(member => ({
				type: 'Identifier',
				name: member.name
			}) as Expression)
		};

		body.push(b`
			function ${definition}(${args}) {
				${instance_javascript}

				${unknown_props_check}

				${component.partly_hoisted}

				${set && b`$$self.$$set = ${set};`}

				${capture_state && b`$$self.$capture_state = ${capture_state};`}

				${inject_state && b`$$self.$inject_state = ${inject_state};`}

				${injected.map(name => b`let ${name};`)}

				${/* before reactive declarations */ props_inject}

				${reactive_declarations.length > 0 && b`
				$$self.$$.update = () => {
					${reactive_declarations}
				};
				`}

				${fixed_reactive_declarations}

				${uses_props && b`$$props = @exclude_internal_props($$props);`}

				return ${return_value};
			}
		`);
	}

	const prop_indexes = x`{
		${props.filter(v => v.export_name && !v.module).map(v => p`${v.export_name}: ${renderer.context_lookup.get(v.name).index}`)}
	}` as ObjectExpression;

	let dirty;
	if (renderer.context_overflow) {
		dirty = x`[]`;
		for (let i = 0; i < renderer.context.length; i += 31) {
			dirty.elements.push(x`-1`);
		}
	}

	const superclass = {
		type: 'Identifier',
		name: '@SvelteComponent'
	};

	const declaration = b`
		class ${name} extends ${superclass} {
			constructor(options) {
				super();
				${should_add_css && b`if (!@_document.getElementById("${component.stylesheet.id}-style")) ${add_css}();`}
				@init(this, options, ${definition}, ${has_create_fragment ? 'create_fragment': 'null'}, ${not_equal}, ${prop_indexes}, ${dirty});
			}
		}
	`[0] as ClassDeclaration;

	declaration.body.body.push(...accessors);

	body.push(declaration);

	return { js: flatten(body, []), css };
}

function flatten(nodes: any[], target: any[]) {
	for (let i = 0; i < nodes.length; i += 1) {
		const node = nodes[i];
		if (Array.isArray(node)) {
			flatten(node, target);
		} else {
			target.push(node);
		}
	}

	return target;
}
