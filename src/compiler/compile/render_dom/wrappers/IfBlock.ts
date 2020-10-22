import Wrapper from './shared/Wrapper';
import Renderer from '../Renderer';
import Block from '../Block';
import IfBlock from '../../nodes/IfBlock';
import ElseBlock from '../../nodes/ElseBlock';
import FragmentWrapper from './Fragment';
import { b, x } from 'code-red';
import { walk } from 'estree-walker';
import { Identifier, Node, UnaryExpression } from 'estree';

function is_else_if(node: ElseBlock) {
	return (
		node && node.children.length === 1 && node.children[0].type === 'IfBlock'
	);
}

class IfBlockBranch extends Wrapper {
	block: Block;
	fragment: FragmentWrapper;
	dependencies?: string[];
	condition?: any;
	snippet?: Node;
	is_dynamic: boolean;

	var = null;

	constructor(
		renderer: Renderer,
		block: Block,
		parent: IfBlockWrapper,
		node: IfBlock | ElseBlock,
		strip_whitespace: boolean,
		next_sibling: Wrapper
	) {
		super(renderer, block, parent, node);

		const { expression } = (node as IfBlock);
		const is_else = !expression;

		if (expression) {
			this.dependencies = expression.dynamic_dependencies();

			// TODO is this the right rule? or should any non-reference count?
			// const should_cache = !is_reference(expression.node, null) && dependencies.length > 0;
			let should_cache = false;
			walk(expression.node, {
				enter(node) {
					if (node.type === 'CallExpression' || node.type === 'NewExpression') {
						should_cache = true;
					}
				}
			});

			if (should_cache) {
				this.condition = block.get_unique_name('show_if');
				this.snippet = (expression.manipulate(block) as Node);
			} else {
				this.condition = expression.manipulate(block);
			}
		}

		this.block = block.child({
			name: parent.renderer.component.get_unique_name(
				is_else ? 'create_else_block' : 'create_if_block'
			),
			type: (node as IfBlock).expression ? 'if' : 'else'
		});

		this.fragment = new FragmentWrapper(renderer, this.block, node.children, parent, strip_whitespace, next_sibling);

		this.is_dynamic = this.block.dependencies.size > 0;
	}
}

export default class IfBlockWrapper extends Wrapper {
	node: IfBlock;
	branches: IfBlockBranch[];
	needs_update = false;

	var: Identifier = { type: 'Identifier', name: 'if_block' };

	constructor(
		renderer: Renderer,
		block: Block,
		parent: Wrapper,
		node: IfBlock,
		strip_whitespace: boolean,
		next_sibling: Wrapper
	) {
		super(renderer, block, parent, node);

		this.cannot_use_innerhtml();
		this.not_static_content();

		this.branches = [];

		const blocks: Block[] = [];
		let is_dynamic = false;

		const create_branches = (node: IfBlock) => {
			const branch = new IfBlockBranch(
				renderer,
				block,
				this,
				node,
				strip_whitespace,
				next_sibling
			);

			this.branches.push(branch);

			blocks.push(branch.block);
			block.add_dependencies(node.expression.dependencies);

			if (branch.block.dependencies.size > 0) {
				// the condition, or its contents, is dynamic
				is_dynamic = true;
				block.add_dependencies(branch.block.dependencies);
			}

			if (branch.dependencies && branch.dependencies.length > 0) {
				// the condition itself is dynamic
				this.needs_update = true;
			}

			if (is_else_if(node.else)) {
				create_branches(node.else.children[0] as IfBlock);
			} else if (node.else) {
				const branch = new IfBlockBranch(
					renderer,
					block,
					this,
					node.else,
					strip_whitespace,
					next_sibling
				);

				this.branches.push(branch);

				blocks.push(branch.block);

				if (branch.block.dependencies.size > 0) {
					is_dynamic = true;
					block.add_dependencies(branch.block.dependencies);
				}
			}
		};

		create_branches(this.node);

		blocks.forEach(block => {
			block.has_update_method = is_dynamic;
		});

		renderer.blocks.push(...blocks);
	}

	render(
		block: Block,
		parent_node: Identifier,
		parent_nodes: Identifier
	) {
		const name = this.var;

		const needs_anchor = this.next ? !this.next.is_dom_node() : !parent_node || !this.parent.is_dom_node();
		const anchor = needs_anchor
			? block.get_unique_name(`${this.var.name}_anchor`)
			: (this.next && this.next.var) || 'null';

		const has_else = !(this.branches[this.branches.length - 1].condition);
		const if_exists_condition = has_else ? null : name;

		const dynamic = this.branches[0].block.has_update_method; // can use [0] as proxy for all, since they necessarily have the same value

		const vars = { name, anchor, if_exists_condition, has_else };

		const detaching = parent_node ? null : 'detaching';

		if (this.node.else) {
			this.branches.forEach(branch => {
				if (branch.snippet) block.add_variable(branch.condition);
			});

			this.render_compound(block, parent_node, parent_nodes, dynamic, vars, detaching);
		} else {
			this.render_simple(block, parent_node, parent_nodes, dynamic, vars, detaching);
		}

		if (if_exists_condition) {
			block.chunks.create.push(b`if (${if_exists_condition}) ${name}.c();`);
		} else {
			block.chunks.create.push(b`${name}.c();`);
		}

		if (parent_nodes && this.renderer.options.hydratable) {
			if (if_exists_condition) {
				block.chunks.claim.push(
					b`if (${if_exists_condition}) ${name}.l(${parent_nodes});`
				);
			} else {
				block.chunks.claim.push(
					b`${name}.l(${parent_nodes});`
				);
			}
		}

		if (needs_anchor) {
			block.add_element(
				anchor as Identifier,
				x`@empty()`,
				parent_nodes && x`@empty()`,
				parent_node
			);
		}

		this.branches.forEach(branch => {
			branch.fragment.render(branch.block, null, x`#nodes` as unknown as Identifier);
		});
	}

	render_compound(
		block: Block,
		parent_node: Identifier,
		_parent_nodes: Identifier,
		dynamic,
		{ name, anchor, has_else, if_exists_condition },
		detaching
	) {
		const select_block_type = this.renderer.component.get_unique_name('select_block_type');
		const current_block_type = block.get_unique_name('current_block_type');
		const get_block = has_else
			? x`${current_block_type}(#ctx)`
			: x`${current_block_type} && ${current_block_type}(#ctx)`;

		if (this.needs_update) {
			block.chunks.init.push(b`
				function ${select_block_type}(#ctx, #dirty) {
					${this.branches.map(({ dependencies, condition, snippet, block }) => condition
					? b`
					${snippet && (
						dependencies.length > 0
							? b`if (${condition} == null || ${block.renderer.dirty(dependencies)}) ${condition} = !!${snippet}`
							: b`if (${condition} == null) ${condition} = !!${snippet}`
					)}
					if (${condition}) return ${block.name};`
					: b`return ${block.name};`)}
				}
			`);
		} else {
			block.chunks.init.push(b`
				function ${select_block_type}(#ctx, #dirty) {
					${this.branches.map(({ condition, snippet, block }) => condition
					? b`if (${snippet || condition}) return ${block.name};`
					: b`return ${block.name};`)}
				}
			`);
		}

		block.chunks.init.push(b`
			let ${current_block_type} = ${select_block_type}(#ctx, ${this.get_initial_dirty_bit()});
			let ${name} = ${get_block};
		`);

		const initial_mount_node = parent_node || '#target';
		const anchor_node = parent_node ? 'null' : '#anchor';

		if (if_exists_condition) {
			block.chunks.mount.push(
				b`if (${if_exists_condition}) ${name}.m(${initial_mount_node}, ${anchor_node});`
			);
		} else {
			block.chunks.mount.push(
				b`${name}.m(${initial_mount_node}, ${anchor_node});`
			);
		}

		if (this.needs_update) {
			const update_mount_node = this.get_update_mount_node(anchor);

			const change_block = b`
				${if_exists_condition ? b`if (${if_exists_condition}) ${name}.d(1)` : b`${name}.d(1)`};
				${name} = ${get_block};
				if (${name}) {
					${name}.c();
					${name}.m(${update_mount_node}, ${anchor});
				}
			`;

			if (dynamic) {
				block.chunks.update.push(b`
					if (${current_block_type} === (${current_block_type} = ${select_block_type}(#ctx, #dirty)) && ${name}) {
						${name}.p(#ctx, #dirty);
					} else {
						${change_block}
					}
				`);
			} else {
				block.chunks.update.push(b`
					if (${current_block_type} !== (${current_block_type} = ${select_block_type}(#ctx, #dirty))) {
						${change_block}
					}
				`);
			}
		} else if (dynamic) {
			if (if_exists_condition) {
				block.chunks.update.push(b`if (${if_exists_condition}) ${name}.p(#ctx, #dirty);`);
			} else {
				block.chunks.update.push(b`${name}.p(#ctx, #dirty);`);
			}
		}

		if (if_exists_condition) {
			block.chunks.destroy.push(b`
				if (${if_exists_condition}) {
					${name}.d(${detaching});
				}
			`);
		} else {
			block.chunks.destroy.push(b`
				${name}.d(${detaching});
			`);
		}
	}

	render_simple(
		block: Block,
		parent_node: Identifier,
		_parent_nodes: Identifier,
		dynamic,
		{ name, anchor, if_exists_condition },
		detaching
	) {
		const branch = this.branches[0];

		if (branch.snippet) block.add_variable(branch.condition, branch.snippet);

		block.chunks.init.push(b`
			let ${name} = ${branch.condition} && ${branch.block.name}(#ctx);
		`);

		const initial_mount_node = parent_node || '#target';
		const anchor_node = parent_node ? 'null' : '#anchor';

		block.chunks.mount.push(
			b`if (${name}) ${name}.m(${initial_mount_node}, ${anchor_node});`
		);

		if (branch.dependencies.length > 0) {
			const update_mount_node = this.get_update_mount_node(anchor);

			const enter = b`
				if (${name}) {
					${dynamic && b`${name}.p(#ctx, #dirty);`}
				} else {
					${name} = ${branch.block.name}(#ctx);
					${name}.c();
					${name}.m(${update_mount_node}, ${anchor});
				}
			`;

			if (branch.snippet) {
				block.chunks.update.push(b`if (${block.renderer.dirty(branch.dependencies)}) ${branch.condition} = ${branch.snippet}`);
			}

			// no `p()` here — we don't want to update outroing nodes,
			// as that will typically result in glitching
			block.chunks.update.push(b`
				if (${branch.condition}) {
					${enter}
				} else if (${name}) {
					${name}.d(1);
					${name} = null;
				}
			`);
		} else if (dynamic) {
			block.chunks.update.push(b`
				if (${branch.condition}) ${name}.p(#ctx, #dirty);
			`);
		}

		if (if_exists_condition) {
			block.chunks.destroy.push(b`
				if (${if_exists_condition}) ${name}.d(${detaching});
			`);
		} else {
			block.chunks.destroy.push(b`
				${name}.d(${detaching});
			`);
		}
	}

	get_initial_dirty_bit() {
		const _this = this;
		// TODO: context-overflow make it less gross
		const val: UnaryExpression = x`-1` as UnaryExpression;
		return {
			get type() {
				return _this.renderer.context_overflow ? 'ArrayExpression' : 'UnaryExpression';
			},
			// as [-1]
			elements: [val],
			// as -1
			operator: val.operator,
			prefix: val.prefix,
			argument: val.argument
		};
	}
}
