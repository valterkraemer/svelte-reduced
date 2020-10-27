import Node from './shared/Node';
import Expression from './shared/Expression';
import Component from '../Component';
import { sanitize } from '../../utils/names';
import { Identifier } from 'estree';

export default class EventHandler extends Node {
	type: 'EventHandler';
	name: string;
	expression: Expression;
	handler_name: Identifier;
	uses_context = false;

	constructor(component: Component, parent, template_scope, info) {
		super(component, parent, template_scope, info);

		this.name = info.name;

		if (info.expression) {
			this.expression = new Expression(component, this, template_scope, info.expression);
			this.uses_context = this.expression.uses_context;

			if (/FunctionExpression/.test(info.expression.type) && info.expression.params.length === 0) {
				// TODO make this detection more accurate — if `event.preventDefault` isn't called, and
				// `event` is passed to another function, we can make it passive
			} else if (info.expression.type === 'Identifier') {
				let node = component.node_for_declaration.get(info.expression.name);

				if (node) {
					if (node.type === 'VariableDeclaration') {
						// for `const handleClick = () => {...}`, we want the [arrow] function expression node
						const declarator = node.declarations.find(d => (d.id as Identifier).name === info.expression.name);
						node = declarator && declarator.init;
					}
				}
			}
		} else {
			this.handler_name = component.get_unique_name(`${sanitize(this.name)}_handler`);
		}
	}

	get reassigned(): boolean {
		if (!this.expression) {
			return false;
		}
		const node = this.expression.node;

		if (/FunctionExpression/.test(node.type)) {
			return false;
		}

		return this.expression.dynamic_dependencies().length > 0;
	}
}
