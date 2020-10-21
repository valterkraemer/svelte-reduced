import Node from './shared/Node';
import Expression from './shared/Expression';
import Component from '../Component';

export default class Animation extends Node {
	type: 'Animation';
	name: string;
	expression: Expression;

	constructor(component: Component, parent, scope, info) {
		super(component, parent, scope, info);

		component.warn_if_undefined(info.name, info, scope);

		this.name = info.name;
		component.add_reference(info.name.split('.')[0]);

		if (parent.animation) {
			component.error(this, {
				code: 'duplicate-animation',
				message: "An element can only have one 'animate' directive"
			});
		}
	}
}
