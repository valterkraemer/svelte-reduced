import { walk } from 'estree-walker';
import { reserved, is_valid } from '../utils/names';
import create_module from './create_module';
import {
	create_scopes,
	extract_names,
	Scope,
	extract_identifiers
} from './utils/scope';
import Stylesheet from './css/Stylesheet';
import { test } from '../config';
import Fragment from './nodes/Fragment';
import internal_exports from './internal_exports';
import { Ast, CompileOptions, Var, CssResult } from '../interfaces';
import error from '../utils/error';
import flatten_reference from './utils/flatten_reference';
import is_reference from 'is-reference';
import get_object from './utils/get_object';
import { Node, ImportDeclaration, Identifier, Program, ExpressionStatement, AssignmentExpression, Literal } from 'estree';
import { print, x, b } from 'code-red';
import { is_reserved_keyword } from './utils/reserved_keywords';
import Element from './nodes/Element';

interface ComponentOptions {
	accessors?: boolean;
}

export default class Component {
	ast: Ast;
	original_ast: Ast;
	name: Identifier;
	compile_options: CompileOptions;
	fragment: Fragment;
	instance_scope: Scope;
	instance_scope_map: WeakMap<Node, Scope>;

	component_options: ComponentOptions;
	accessors: boolean;

	vars: Var[] = [];
	var_lookup: Map<string, Var> = new Map();

	imports: ImportDeclaration[] = [];

	hoistable_nodes: Set<Node> = new Set();
	node_for_declaration: Map<string, Node> = new Map();
	partly_hoisted: Array<(Node | Node[])> = [];
	fully_hoisted: Array<(Node | Node[])> = [];
	reactive_declarations: Array<{
		assignees: Set<string>;
		dependencies: Set<string>;
		node: Node;
		declaration: Node;
	}> = [];
	reactive_declaration_nodes: Set<Node> = new Set();
	has_reactive_assignments = false;
	injected_reactive_declaration_vars: Set<string> = new Set();
	helpers: Map<string, Identifier> = new Map();
	globals: Map<string, Identifier> = new Map();

	indirect_dependencies: Map<string, Set<string>> = new Map();

	file: string;

	elements: Element[] = [];
	stylesheet: Stylesheet;

	aliases: Map<string, Identifier> = new Map();
	used_names: Set<string> = new Set();
	globally_used_names: Set<string> = new Set();

	constructor(
		ast: Ast,
		source: string,
		name: string,
		compile_options: CompileOptions
	) {
		this.name = { type: 'Identifier', name };

		this.ast = ast;
		this.compile_options = compile_options;

		// the instance JS gets mutated, so we park
		// a copy here for later. TODO this feels gross
		this.original_ast = {
			html: ast.html,
			css: ast.css,
			instance: ast.instance && JSON.parse(JSON.stringify(ast.instance))
		};

		this.file =
			compile_options.filename &&
			(typeof process !== 'undefined'
				? compile_options.filename
					.replace(process.cwd(), '')
					.replace(/^[/\\]/, '')
				: compile_options.filename);

		// styles
		this.stylesheet = new Stylesheet(
			source,
			ast,
			compile_options.filename
		);
		this.stylesheet.validate(this);

		this.component_options = process_component_options(
			this
		);

		this.walk_instance_js_pre_template();

		this.fragment = new Fragment(this, ast.html);
		this.name = this.get_unique_name(name);

		this.walk_instance_js_post_template();

		this.elements.forEach(element => this.stylesheet.apply(element));
		this.stylesheet.reify();
	}

	add_var(variable: Var) {
		this.vars.push(variable);
		this.var_lookup.set(variable.name, variable);
	}

	add_reference(name: string) {
		const variable = this.var_lookup.get(name);

		if (variable) {
			variable.referenced = true;
		} else if (is_reserved_keyword(name)) {
			this.add_var({
				name,
				injected: true,
				referenced: true
			});
		} else if (name[0] === '$') {
			this.add_var({
				name,
				injected: true,
				referenced: true,
				mutated: true,
				writable: true
			});
		} else {
			this.used_names.add(name);
		}
	}

	alias(name: string) {
		if (!this.aliases.has(name)) {
			this.aliases.set(name, this.get_unique_name(name));
		}

		return this.aliases.get(name);
	}

	apply_stylesheet(element: Element) {
		this.elements.push(element);
	}

	global(name: string) {
		const alias = this.alias(name);
		this.globals.set(name, alias);
		return alias;
	}

	generate(result?: { js: Node[]; css: CssResult }) {
		let js = null;
		let css = null;

		if (result) {
			const { compile_options, name } = this;
			const { format = 'esm' } = compile_options;

			const program: any = { type: 'Program', body: result.js };

			walk(program, {
				enter: (node: Node, parent: Node, key) => {
					if (node.type === 'Identifier') {
						if (node.name[0] === '@') {
							if (node.name[1] === '_') {
								const alias = this.global(node.name.slice(2));
								node.name = alias.name;
							} else {
								const name = node.name.slice(1);

								const alias = this.alias(name);
								this.helpers.set(name, alias);
								node.name = alias.name;
							}
						}

						else if (node.name[0] !== '#' && !is_valid(node.name)) {
							// this hack allows x`foo.${bar}` where bar could be invalid
							const literal: Literal = { type: 'Literal', value: node.name };

							if (parent.type === 'Property' && key === 'key') {
								parent.key = literal;
							}

							else if (parent.type === 'MemberExpression' && key === 'property') {
								parent.property = literal;
								parent.computed = true;
							}
						}
					}
				}
			});

			const referenced_globals = Array.from(
				this.globals,
				([name, alias]) => name !== alias.name && { name, alias }
			).filter(Boolean);
			if (referenced_globals.length) {
				this.helpers.set('globals', this.alias('globals'));
			}
			const imported_helpers = Array.from(this.helpers, ([name, alias]) => ({
				name,
				alias
			}));

			create_module(
				program,
				format,
				name,
				compile_options.sveltePath,
				imported_helpers,
				referenced_globals,
				this.imports
			);

			css = result.css;

			js = print(program);
		}

		return {
			js,
			css,
			ast: this.original_ast,
			warnings: [], // Keep REPL happy
			vars: this.vars
				.filter(v => !v.global && !v.internal)
				.map(v => ({
					name: v.name,
					export_name: v.export_name || null,
					injected: v.injected || false,
					mutated: v.mutated || false,
					reassigned: v.reassigned || false,
					referenced: v.referenced || false,
					writable: v.writable || false
				}))
		};
	}

	get_unique_name(name: string, scope?: Scope): Identifier {
		if (test) name = `${name}$`;
		let alias = name;
		for (
			let i = 1;
			reserved.has(alias) ||
			this.var_lookup.has(alias) ||
			this.used_names.has(alias) ||
			this.globally_used_names.has(alias) ||
			(scope && scope.has(alias));
			alias = `${name}_${i++}`
		);
		this.used_names.add(alias);
		return { type: 'Identifier', name: alias };
	}

	get_unique_name_maker() {
		const local_used_names = new Set();

		function add(name: string) {
			local_used_names.add(name);
		}

		reserved.forEach(add);
		internal_exports.forEach(add);
		this.var_lookup.forEach((_value, key) => add(key));

		return (name: string): Identifier => {
			if (test) name = `${name}$`;
			let alias = name;
			for (
				let i = 1;
				this.used_names.has(alias) || local_used_names.has(alias);
				alias = `${name}_${i++}`
			);
			local_used_names.add(alias);
			this.globally_used_names.add(alias);

			return {
				type: 'Identifier',
				name: alias
			};
		};
	}

	error(
		e: {
			code: string;
			message: string;
		}
	) {
		error(e.message, {
			name: 'ValidationError',
			code: e.code,
			filename: this.compile_options.filename
		});
	}

	extract_imports(node) {
		this.imports.push(node);
	}

	extract_exports(node) {
		if (node.type === 'ExportDefaultDeclaration') {
			this.error({
				code: 'default-export',
				message: 'A component cannot have a default export'
			});
		}

		if (node.type === 'ExportNamedDeclaration') {
			if (node.source) {
				this.error({
					code: 'not-implemented',
					message: 'A component currently cannot have an export ... from'
				});
			}
			if (node.declaration) {
				if (node.declaration.type === 'VariableDeclaration') {
					node.declaration.declarations.forEach(declarator => {
						extract_names(declarator.id).forEach(name => {
							const variable = this.var_lookup.get(name);
							variable.export_name = name;
						});
					});
				} else {
					const { name } = node.declaration.id;

					const variable = this.var_lookup.get(name);
					variable.export_name = name;
				}

				return node.declaration;
			} else {
				node.specifiers.forEach(specifier => {
					const variable = this.var_lookup.get(specifier.local.name);

					if (variable) {
						variable.export_name = specifier.exported.name;
					}
				});

				return null;
			}
		}
	}

	extract_javascript(script) {
		if (!script) return null;

		return script.content.body.filter(node => {
			if (!node) return false;
			if (this.hoistable_nodes.has(node)) return false;
			if (this.reactive_declaration_nodes.has(node)) return false;
			if (node.type === 'ImportDeclaration') return false;
			if (node.type === 'ExportDeclaration' && node.specifiers.length > 0)
				return false;
			return true;
		});
	}

	walk_instance_js_pre_template() {
		const script = this.ast.instance;
		if (!script) return;

		// inject vars for reactive declarations
		script.content.body.forEach(node => {
			if (node.type !== 'LabeledStatement') return;
			if (node.body.type !== 'ExpressionStatement') return;

			const { expression } = node.body;
			if (expression.type !== 'AssignmentExpression') return;
			if (expression.left.type === 'MemberExpression') return;

			extract_names(expression.left).forEach(name => {
				if (!this.var_lookup.has(name) && name[0] !== '$') {
					this.injected_reactive_declaration_vars.add(name);
				}
			});
		});

		const { scope: instance_scope, map, globals } = create_scopes(
			script.content
		);
		this.instance_scope = instance_scope;
		this.instance_scope_map = map;

		instance_scope.declarations.forEach((node, name) => {
			if (name[0] === '$') {
				this.error({
					code: 'illegal-declaration',
					message: 'The $ prefix is reserved, and cannot be used for variable and import names'
				});
			}

			const writable = node.type === 'VariableDeclaration' && (node.kind === 'var' || node.kind === 'let');
			const imported = node.type.startsWith('Import');

			this.add_var({
				name,
				initialised: instance_scope.initialised_declarations.has(name),
				writable,
				imported
			});

			this.node_for_declaration.set(name, node);
		});

		globals.forEach((_node, name) => {
			if (this.var_lookup.has(name)) return;

			if (this.injected_reactive_declaration_vars.has(name)) {
				this.add_var({
					name,
					injected: true,
					writable: true,
					reassigned: true,
					initialised: true
				});
			} else if (is_reserved_keyword(name)) {
				this.add_var({
					name,
					injected: true
				});
			} else if (name[0] === '$') {
				if (name === '$' || name[1] === '$') {
					this.error({
						code: 'illegal-global',
						message: `${name} is an illegal variable name`
					});
				}

				this.add_var({
					name,
					injected: true,
					mutated: true,
					writable: true
				});

				this.add_reference(name.slice(1));
			} else {
				this.add_var({
					name,
					global: true,
					hoistable: true
				});
			}
		});

		this.track_references_and_mutations();
	}

	walk_instance_js_post_template() {
		const script = this.ast.instance;
		if (!script) return;

		this.post_template_walk();

		this.hoist_instance_declarations();
		this.extract_reactive_declarations();
	}

	post_template_walk() {
		const script = this.ast.instance;
		if (!script) return;

		const component = this;
		const { content } = script;
		const { instance_scope, instance_scope_map: map } = this;

		let scope = instance_scope;

		const to_remove = [];
		const remove = (parent, prop, index) => {
			to_remove.unshift([parent, prop, index]);
		};

		walk(content, {
			enter(node: Node, parent, prop, index) {
				if (map.has(node)) {
					scope = map.get(node);
				}

				if (node.type === 'ImportDeclaration') {
					component.extract_imports(node);
					// TODO: to use actual remove
					remove(parent, prop, index);
					return this.skip();
				}

				if (/^Export/.test(node.type)) {
					const replacement = component.extract_exports(node);
					if (replacement) {
						this.replace(replacement);
					} else {
						// TODO: to use actual remove
						remove(parent, prop, index);
					}
					return this.skip();
				}

				component.warn_on_undefined_store_value_references(node, parent, scope);
			},

			leave(node: Node) {
				if (map.has(node)) {
					scope = scope.parent;
				}
			}
		});

		for (const [parent, prop, index] of to_remove) {
			if (parent) {
				if (index !== null) {
					parent[prop].splice(index, 1);
				} else {
					delete parent[prop];
				}
			}
		}
	}

	track_references_and_mutations() {
		const script = this.ast.instance;
		if (!script) return;

		const component = this;
		const { content } = script;
		const { instance_scope, instance_scope_map: map } = this;

		let scope = instance_scope;

		walk(content, {
			enter(node: Node) {
				if (map.has(node)) {
					scope = map.get(node);
				}

				if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
					const assignee = node.type === 'AssignmentExpression' ? node.left : node.argument;
					const names = extract_names(assignee);

					const deep = assignee.type === 'MemberExpression';

					names.forEach(name => {
						const scope_owner = scope.find_owner(name);
						if (
							scope_owner !== null && scope_owner === instance_scope
						) {
							const variable = component.var_lookup.get(name);
							variable[deep ? 'mutated' : 'reassigned'] = true;
						}
					});
				}
			},

			leave(node: Node) {
				if (map.has(node)) {
					scope = scope.parent;
				}
			}
		});
	}

	warn_on_undefined_store_value_references(node, parent, scope: Scope) {
		if (is_reference(node as Node, parent as Node)) {
			const object = get_object(node);
			const { name } = object;

			if (name[0] === '$') {
				if (!scope.has(name)) {
					this.warn_if_undefined(name);
				}

				if (name[1] !== '$' && scope.has(name.slice(1)) && scope.find_owner(name.slice(1)) !== this.instance_scope) {
					this.error({
						code: 'contextual-store',
						message: 'Stores must be declared at the top level of the component (this may change in a future version of Svelte)'
					});
				}
			}
		}
	}

	loop_protect(node, scope: Scope, timeout: number): Node | null {
		if (node.type === 'WhileStatement' ||
			node.type === 'ForStatement' ||
			node.type === 'DoWhileStatement') {
			const guard = this.get_unique_name('guard', scope);
			this.used_names.add(guard.name);

			const before = b`const ${guard} = @loop_guard(${timeout})`;
			const inside = b`${guard}();`;

			// wrap expression statement with BlockStatement
			if (node.body.type !== 'BlockStatement') {
				node.body = {
					type: 'BlockStatement',
					body: [node.body]
				};
			}
			node.body.body.push(inside[0]);

			return {
				type: 'BlockStatement',
				body: [
					before[0],
					node
				]
			};
		}
		return null;
	}

	rewrite_props() {
		if (!this.ast.instance) return;

		const component = this;
		const { instance_scope, instance_scope_map: map } = this;
		let scope = instance_scope;

		walk(this.ast.instance.content, {
			enter(node: Node, parent, key, index) {
				if (/Function/.test(node.type)) {
					return this.skip();
				}

				if (map.has(node)) {
					scope = map.get(node);
				}

				if (node.type === 'VariableDeclaration') {
					if (node.kind === 'var' || scope === instance_scope) {
						node.declarations.forEach(declarator => {
							if (declarator.id.type !== 'Identifier') {
								const inserts = [];

								extract_names(declarator.id).forEach(name => {
									const variable = component.var_lookup.get(name);

									if (variable.export_name) {
										// TODO is this still true post-#3539?
										component.error({
											code: 'destructured-prop',
											message: 'Cannot declare props in destructured declaration'
										});
									}
								});

								if (inserts.length) {
									parent[key].splice(index + 1, 0, ...inserts);
								}

								return;
							}

							const { name } = declarator.id;
							const variable = component.var_lookup.get(name);

							if (variable.export_name && variable.writable) {
								declarator.id = {
									type: 'ObjectPattern',
									properties: [{
										type: 'Property',
										method: false,
										shorthand: false,
										computed: false,
										kind: 'init',
										key: { type: 'Identifier', name: variable.export_name },
										value: declarator.init
											? {
												type: 'AssignmentPattern',
												left: declarator.id,
												right: declarator.init
											}
											: declarator.id
									}]
								};

								declarator.init = x`$$props`;
							}
						});
					}
				}
			},

			leave(node: Node, parent, _key, index) {
				if (map.has(node)) {
					scope = scope.parent;
				}

				if (node.type === 'ExportNamedDeclaration' && node.declaration) {
					(parent as Program).body[index] = node.declaration;
				}
			}
		});
	}

	hoist_instance_declarations() {
		// we can safely hoist variable declarations that are
		// initialised to literals, and functions that don't
		// reference instance variables other than other
		// hoistable functions. TODO others?

		const {
			hoistable_nodes,
			var_lookup,
			injected_reactive_declaration_vars,
			imports
		} = this;

		const top_level_function_declarations = new Map();

		const { body } = this.ast.instance.content;

		for (let i = 0; i < body.length; i += 1) {
			const node = body[i];

			if (node.type === 'VariableDeclaration') {
				const all_hoistable = node.declarations.every(d => {
					if (!d.init) return false;
					if (d.init.type !== 'Literal') return false;

					// everything except const values can be changed by e.g. svelte devtools
					// which means we can't hoist it

					const { name } = d.id as Identifier;

					const v = this.var_lookup.get(name);
					if (v.reassigned) return false;
					if (v.export_name) return false;

					if (this.var_lookup.get(name).reassigned) return false;

					return true;
				});

				if (all_hoistable) {
					node.declarations.forEach(d => {
						const variable = this.var_lookup.get((d.id as Identifier).name);
						variable.hoistable = true;
					});

					hoistable_nodes.add(node);

					body.splice(i--, 1);
					this.fully_hoisted.push(node);
				}
			}

			if (
				node.type === 'ExportNamedDeclaration' &&
				node.declaration &&
				node.declaration.type === 'FunctionDeclaration'
			) {
				top_level_function_declarations.set(node.declaration.id.name, node);
			}

			if (node.type === 'FunctionDeclaration') {
				top_level_function_declarations.set(node.id.name, node);
			}
		}

		const checked = new Set();
		const walking = new Set();

		const is_hoistable = fn_declaration => {
			if (fn_declaration.type === 'ExportNamedDeclaration') {
				fn_declaration = fn_declaration.declaration;
			}

			const instance_scope = this.instance_scope;
			let scope = this.instance_scope;
			const map = this.instance_scope_map;

			let hoistable = true;

			// handle cycles
			walking.add(fn_declaration);

			walk(fn_declaration, {
				enter(node: Node, parent) {
					if (!hoistable) return this.skip();

					if (map.has(node)) {
						scope = map.get(node);
					}

					if (is_reference(node as Node, parent as Node)) {
						const { name } = flatten_reference(node);
						const owner = scope.find_owner(name);

						if (injected_reactive_declaration_vars.has(name)) {
							hoistable = false;
						} else if (name[0] === '$' && !owner) {
							hoistable = false;
						} else if (owner === instance_scope) {
							const variable = var_lookup.get(name);

							if (variable.reassigned || variable.mutated) hoistable = false;

							if (name === fn_declaration.id.name) return;

							if (variable.hoistable) return;

							if (top_level_function_declarations.has(name)) {
								const other_declaration = top_level_function_declarations.get(
									name
								);

								if (walking.has(other_declaration)) {
									hoistable = false;
								} else if (
									other_declaration.type === 'ExportNamedDeclaration' &&
									walking.has(other_declaration.declaration)
								) {
									hoistable = false;
								} else if (!is_hoistable(other_declaration)) {
									hoistable = false;
								}
							} else {
								hoistable = false;
							}
						}

						this.skip();
					}
				},

				leave(node: Node) {
					if (map.has(node)) {
						scope = scope.parent;
					}
				}
			});

			checked.add(fn_declaration);
			walking.delete(fn_declaration);

			return hoistable;
		};

		for (const [name, node] of top_level_function_declarations) {
			if (is_hoistable(node)) {
				const variable = this.var_lookup.get(name);
				variable.hoistable = true;
				hoistable_nodes.add(node);

				const i = body.indexOf(node);
				body.splice(i, 1);
				this.fully_hoisted.push(node);
			}
		}

		for (const { specifiers } of imports) {
			for (const specifier of specifiers) {
				const variable = var_lookup.get(specifier.local.name);

				if (!variable.mutated) {
					variable.hoistable = true;
				}
			}
		}
	}

	extract_reactive_declarations() {
		const component = this;

		const unsorted_reactive_declarations = [];

		this.ast.instance.content.body.forEach(node => {
			if (node.type === 'LabeledStatement' && node.label.name === '$') {
				this.reactive_declaration_nodes.add(node);

				const assignees = new Set();
				const assignee_nodes = new Set();
				const dependencies = new Set();

				let scope = this.instance_scope;
				const map = this.instance_scope_map;

				walk(node.body, {
					enter(node: Node, parent) {
						if (map.has(node)) {
							scope = map.get(node);
						}

						if (node.type === 'AssignmentExpression') {
							const left = get_object(node.left);

							extract_identifiers(left).forEach(node => {
								assignee_nodes.add(node);
								assignees.add(node.name);
							});

							if (node.operator !== '=') {
								dependencies.add(left.name);
							}
						} else if (node.type === 'UpdateExpression') {
							const identifier = get_object(node.argument);
							assignees.add(identifier.name);
						} else if (is_reference(node as Node, parent as Node)) {
							const identifier = get_object(node);
							if (!assignee_nodes.has(identifier)) {
								const { name } = identifier;
								const owner = scope.find_owner(name);
								const variable = component.var_lookup.get(name);
								if (variable) variable.is_reactive_dependency = true;
								const is_writable_or_mutated =
									variable && (variable.writable || variable.mutated);
								if (
									(!owner || owner === component.instance_scope) &&
									(name[0] === '$' || is_writable_or_mutated)
								) {
									dependencies.add(name);
								}
							}

							this.skip();
						}
					},

					leave(node: Node) {
						if (map.has(node)) {
							scope = scope.parent;
						}
					}
				});

				const { expression } = node.body as ExpressionStatement;
				const declaration = expression && (expression as AssignmentExpression).left;

				unsorted_reactive_declarations.push({
					assignees,
					dependencies,
					node,
					declaration
				});
			}
		});

		const lookup = new Map();

		unsorted_reactive_declarations.forEach(declaration => {
			declaration.assignees.forEach(name => {
				if (!lookup.has(name)) {
					lookup.set(name, []);
				}

				// TODO warn or error if a name is assigned to in
				// multiple reactive declarations?
				lookup.get(name).push(declaration);
			});
		});

		const add_declaration = declaration => {
			if (this.reactive_declarations.includes(declaration)) return;

			declaration.dependencies.forEach(name => {
				if (declaration.assignees.has(name)) return;
				const earlier_declarations = lookup.get(name);
				if (earlier_declarations)
					earlier_declarations.forEach(add_declaration);
			});

			this.reactive_declarations.push(declaration);
		};

		unsorted_reactive_declarations.forEach(add_declaration);
	}

	warn_if_undefined(name: string) {
		if (name[0] === '$') {
			if (name === '$' || name[1] === '$' && !is_reserved_keyword(name)) {
				this.error({
					code: 'illegal-global',
					message: `${name} is an illegal variable name`
				});
			}

			this.has_reactive_assignments = true; // TODO does this belong here?
		}
	}
}

function process_component_options(component: Component) {
	const component_options: ComponentOptions = {
		accessors:
			'accessors' in component.compile_options
				? component.compile_options.accessors
				: false
	};

	return component_options;
}
