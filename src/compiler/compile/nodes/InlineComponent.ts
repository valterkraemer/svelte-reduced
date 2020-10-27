import Node from './shared/Node';
import Attribute from './Attribute';
import map_children from './shared/map_children';
import Binding from './Binding';
import EventHandler from './EventHandler';
import Expression from './shared/Expression';
import Component from '../Component';
import TemplateScope from './shared/TemplateScope';
import { INode } from './interfaces';

export default class InlineComponent extends Node {
	type: 'InlineComponent';
	name: string;
	expression: Expression;
	attributes: Attribute[] = [];
	bindings: Binding[] = [];
	handlers: EventHandler[] = [];
	children: INode[];
	scope: TemplateScope;

	constructor(component: Component, parent, scope, info) {
		super(component, parent, scope, info);

		const name = info.name.split('.')[0]; // accommodate namespaces
		component.warn_if_undefined(name);
		component.add_reference(name);

		this.name = info.name;

		this.expression = null;

		info.attributes.forEach(node => {
			/* eslint-disable no-fallthrough */
			switch (node.type) {
				case 'Attribute':
					this.attributes.push(new Attribute(component, this, scope, node));
					break;

				case 'Binding':
					this.bindings.push(new Binding(component, this, scope, node));
					break;

				case 'Class':
					component.error({
						code: 'invalid-class',
						message: 'Classes can only be applied to DOM elements, not components'
					});

				case 'EventHandler':
					this.handlers.push(new EventHandler(component, this, scope, node));
					break;

				default:
					throw new Error(`Not implemented: ${node.type}`);
			}
			/* eslint-enable no-fallthrough */
		});

		this.scope = scope;

		this.children = map_children(component, this, this.scope, info.children);
	}
}
