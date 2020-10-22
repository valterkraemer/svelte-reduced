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
		component.warn_if_undefined(name, info, scope);
		component.add_reference(name);

		this.name = info.name;

		this.expression = null;

		info.attributes.forEach(node => {
			/* eslint-disable no-fallthrough */
			switch (node.type) {
				case 'Attribute':
				case 'Spread':
					this.attributes.push(new Attribute(component, this, scope, node));
					break;

				case 'Binding':
					this.bindings.push(new Binding(component, this, scope, node));
					break;

				case 'Class':
					component.error(node, {
						code: 'invalid-class',
						message: 'Classes can only be applied to DOM elements, not components'
					});

				case 'EventHandler':
					this.handlers.push(new EventHandler(component, this, scope, node));
					break;

				case 'Transition':
					component.error(node, {
						code: 'invalid-transition',
						message: 'Transitions can only be applied to DOM elements, not components'
					});

				default:
					throw new Error(`Not implemented: ${node.type}`);
			}
			/* eslint-enable no-fallthrough */
		});

		this.scope = scope;

		this.handlers.forEach(handler => {
			handler.modifiers.forEach(modifier => {
				if (modifier !== 'once') {
					component.error(handler, {
						code: 'invalid-event-modifier',
						message: "Event modifiers other than 'once' can only be used on DOM elements"
					});
				}
			});
		});

		this.children = map_children(component, this, this.scope, info.children);
	}
}
