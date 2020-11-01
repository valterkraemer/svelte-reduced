import Node from './shared/Node';
import Binding from './Binding';
import EventHandler from './EventHandler';
import flatten_reference from '../utils/flatten_reference';
import list from '../../utils/list';

const valid_bindings = [
	'innerWidth',
	'innerHeight',
	'outerWidth',
	'outerHeight',
	'scrollX',
	'scrollY',
	'online'
];

export default class Window extends Node {
	type: 'Window';
	handlers: EventHandler[] = [];
	bindings: Binding[] = [];

	constructor(component, parent, scope, info) {
		super(component, parent, scope, info);

		info.attributes.forEach(node => {
			if (node.type === 'EventHandler') {
				this.handlers.push(new EventHandler(component, this, scope, node));
			}

			else if (node.type === 'Binding') {
				if (node.expression.type !== 'Identifier') {
					const { parts } = flatten_reference(node.expression);

					// TODO is this constraint necessary?
					component.error(node.expression, {
						code: 'invalid-binding',
						message: `Bindings on <svelte:window> must be to top-level properties, e.g. '${parts[parts.length - 1]}' rather than '${parts.join('.')}'`
					});
				}

				if (!~valid_bindings.indexOf(node.name)) {
					const match = (
						node.name === 'width' ? 'innerWidth' :
							node.name === 'height' ? 'innerHeight' :
								false
					);

					const message = `'${node.name}' is not a valid binding on <svelte:window>`;

					if (match) {
						component.error(node, {
							code: 'invalid-binding',
							message: `${message} (did you mean '${match}'?)`
						});
					} else {
						component.error(node, {
							code: 'invalid-binding',
							message: `${message} — valid bindings are ${list(valid_bindings)}`
						});
					}
				}

				this.bindings.push(new Binding(component, this, scope, node));
			}

			else {
				// TODO there shouldn't be anything else here...
			}
		});
	}
}
