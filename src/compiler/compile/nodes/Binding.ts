import Node from './shared/Node';
import get_object from '../utils/get_object';
import Expression from './shared/Expression';
import Component from '../Component';
import TemplateScope from './shared/TemplateScope';
import {dimensions} from '../../utils/patterns';
import { Node as ESTreeNode } from 'estree';

export default class Binding extends Node {
	type: 'Binding';
	name: string;
	expression: Expression;
	raw_expression: ESTreeNode; // TODO exists only for bind:this — is there a more elegant solution?
	is_contextual: boolean;
	is_readonly: boolean;

	constructor(component: Component, parent, scope: TemplateScope, info) {
		super(component, parent, scope, info);

		if (info.expression.type !== 'Identifier' && info.expression.type !== 'MemberExpression') {
			component.error({
				code: 'invalid-directive-value',
				message: 'Can only bind to an identifier (e.g. `foo`) or a member expression (e.g. `foo.bar` or `foo[baz]`)'
			});
		}

		this.name = info.name;
		this.expression = new Expression(component, this, scope, info.expression);
		this.raw_expression = JSON.parse(JSON.stringify(info.expression));

		const { name } = get_object(this.expression.node);

		this.is_contextual = Array.from(this.expression.references).some(name => scope.names.has(name));

		// make sure we track this as a mutable ref
		if (scope.is_let(name)) {
			component.error({
				code: 'invalid-binding',
				message: 'Cannot bind to a variable declared with the let: directive'
			});
		} else if (scope.names.has(name)) {
			scope.dependencies_for_name.get(name).forEach(name => {
				const variable = component.var_lookup.get(name);
				if (variable) {
					variable.mutated = true;
				}
			});
		} else {
			const variable = component.var_lookup.get(name);

			if (!variable || variable.global) component.error({
				code: 'binding-undeclared',
				message: `${name} is not declared`
			});

			variable[this.expression.node.type === 'MemberExpression' ? 'mutated' : 'reassigned'] = true;

			if (info.expression.type === 'Identifier' && !variable.writable) component.error({
				code: 'invalid-binding',
				message: 'Cannot bind to a variable which is not writable'
			});
		}

		const type = parent.get_static_attribute_value('type');

		this.is_readonly = (
			dimensions.test(this.name) ||
			(parent.name === 'input' && type === 'file') // TODO others?
		);
	}
}
