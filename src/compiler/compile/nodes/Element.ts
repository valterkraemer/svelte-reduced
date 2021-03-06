import { is_void } from '../../utils/names';
import Node from './shared/Node';
import Attribute from './Attribute';
import Binding from './Binding';
import EventHandler from './EventHandler';
import Class from './Class';
import Text from './Text';
import map_children from './shared/map_children';
import { dimensions } from '../../utils/patterns';
import TemplateScope from './shared/TemplateScope';
import { INode } from './interfaces';
import Component from '../Component';

export default class Element extends Node {
	type: 'Element';
	name: string;
	scope: TemplateScope;
	attributes: Attribute[] = [];
	bindings: Binding[] = [];
	classes: Class[] = [];
	handlers: EventHandler[] = [];
	children: INode[];

	constructor(component: Component, parent, scope, info: any) {
		super(component, parent, scope, info);
		this.name = info.name;

		if (this.name === 'textarea') {
			if (info.children.length > 0) {
				const value_attribute = info.attributes.find(node => node.name === 'value');
				if (value_attribute) {
					component.error({
						code: 'textarea-duplicate-value',
						message: 'A <textarea> can have either a value attribute or (equivalently) child content, but not both'
					});
				}

				// this is an egregious hack, but it's the easiest way to get <textarea>
				// children treated the same way as a value attribute
				info.attributes.push({
					type: 'Attribute',
					name: 'value',
					value: info.children
				});

				info.children = [];
			}
		}

		// Binding relies on Attribute, defer its evaluation
		const order = ['Binding']; // everything else is -1
		info.attributes.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

		info.attributes.forEach(node => {
			switch (node.type) {
				case 'Attribute':
					this.attributes.push(new Attribute(component, this, scope, node));
					break;

				case 'Binding':
					this.bindings.push(new Binding(component, this, scope, node));
					break;

				case 'Class':
					this.classes.push(new Class(component, this, scope, node));
					break;

				case 'EventHandler':
					this.handlers.push(new EventHandler(component, this, scope, node));
					break;

				default:
					throw new Error(`Not implemented: ${node.type}`);
			}
		});

		this.scope = scope;
		this.children = map_children(component, this, this.scope, info.children);

		this.validate();

		component.apply_stylesheet(this);
	}

	validate() {
		this.validate_attributes();
		this.validate_bindings();
	}

	validate_attributes() {
		const { component } = this;

		const attribute_map = new Map();

		this.attributes.forEach(attribute => {
			const name = attribute.name.toLowerCase();

			if (/(^[0-9-.])|[\^$@%&#?!|()[\]{}^*+~;]/.test(name)) {
				component.error({
					code: 'illegal-attribute',
					message: `'${name}' is not a valid attribute name`
				});
			}

			attribute_map.set(attribute.name, attribute);
		});
	}

	validate_bindings() {
		const { component } = this;

		const check_type_attribute = () => {
			const attribute = this.attributes.find(
				(attribute: Attribute) => attribute.name === 'type'
			);

			if (!attribute) return null;

			if (!attribute.is_static) {
				component.error({
					code: 'invalid-type',
					message: '\'type\' attribute cannot be dynamic if input uses two-way binding'
				});
			}

			const value = attribute.get_static_value();

			if (value === true) {
				component.error({
					code: 'missing-type',
					message: '\'type\' attribute must be specified'
				});
			}

			return value;
		};

		this.bindings.forEach(binding => {
			const { name } = binding;

			if (name === 'value') {
				if (
					this.name !== 'input' &&
					this.name !== 'textarea'
				) {
					component.error({
						code: 'invalid-binding',
						message: `'value' is not a valid binding on <${this.name}> elements`
					});
				}

				check_type_attribute();
			} else if (name === 'checked' || name === 'indeterminate') {
				if (this.name !== 'input') {
					component.error({
						code: 'invalid-binding',
						message: `'${name}' is not a valid binding on <${this.name}> elements`
					});
				}

				const type = check_type_attribute();

				if (type !== 'checkbox') {
					let message = `'${name}' binding can only be used with <input type="checkbox">`;
					if (type === 'radio') message += ' — for <input type="radio">, use \'group\' binding';
					component.error({ code: 'invalid-binding', message });
				}
			} else if (name === 'files') {
				if (this.name !== 'input') {
					component.error({
						code: 'invalid-binding',
						message: `'files' is not a valid binding on <${this.name}> elements`
					});
				}

				const type = check_type_attribute();

				if (type !== 'file') {
					component.error({
						code: 'invalid-binding',
						message: '\'files\' binding can only be used with <input type="file">'
					});
				}

			} else if (name === 'open') {
				if (this.name !== 'details') {
					component.error({
						code: 'invalid-binding',
						message: `'${name}' binding can only be used with <details>`
					});
				}
			} else if (dimensions.test(name)) {
				if (is_void(this.name)) {
					component.error({
						code: 'invalid-binding',
						message: `'${binding.name}' is not a valid binding on void elements like <${this.name}>. Use a wrapper element instead`
					});
				}
			} else if (
				name === 'textContent' ||
				name === 'innerHTML'
			) {
				const contenteditable = this.attributes.find(
					(attribute: Attribute) => attribute.name === 'contenteditable'
				);

				if (!contenteditable) {
					component.error({
						code: 'missing-contenteditable-attribute',
						message: '\'contenteditable\' attribute is required for textContent and innerHTML two-way bindings'
					});
				} else if (contenteditable && !contenteditable.is_static) {
					component.error({
						code: 'dynamic-contenteditable-attribute',
						message: '\'contenteditable\' attribute cannot be dynamic if element uses two-way binding'
					});
				}
			} else {
				component.error({
					code: 'invalid-binding',
					message: `'${binding.name}' is not a valid binding`
				});
			}
		});
	}

	add_css_class() {
		const { id } = this.component.stylesheet;

		const class_attribute = this.attributes.find(a => a.name === 'class');

		if (class_attribute && !class_attribute.is_true) {
			if (class_attribute.chunks.length === 1 && class_attribute.chunks[0].type === 'Text') {
				(class_attribute.chunks[0] as Text).data += ` ${id}`;
			} else {
				(class_attribute.chunks as Node[]).push(
					new Text(this.component, this, this.scope, {
						type: 'Text',
						data: ` ${id}`,
						synthetic: true
					})
				);
			}
		} else {
			this.attributes.push(
				new Attribute(this.component, this, this.scope, {
					type: 'Attribute',
					name: 'class',
					value: [{ type: 'Text', data: id, synthetic: true }]
				})
			);
		}
	}
}
