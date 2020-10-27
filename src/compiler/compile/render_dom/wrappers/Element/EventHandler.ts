import EventHandler from '../../../nodes/EventHandler';
import Wrapper from '../shared/Wrapper';
import Block from '../../Block';
import { b, x } from 'code-red';
import { Expression } from 'estree';

export default class EventHandlerWrapper {
	node: EventHandler;
	parent: Wrapper;

	constructor(node: EventHandler, parent: Wrapper) {
		this.node = node;
		this.parent = parent;

		if (!node.expression) {
			this.parent.renderer.add_to_context(node.handler_name.name);

			this.parent.renderer.component.partly_hoisted.push(b`
				function ${node.handler_name.name}(event) {
					@bubble($$self, event);
				}
			`);
		}
	}

	get_snippet(block) {
		const snippet = this.node.expression ? this.node.expression.manipulate(block) : block.renderer.reference(this.node.handler_name);

		if (this.node.reassigned) {
			block.maintain_context = true;
			return x`function () { if (@is_function(${snippet})) ${snippet}.apply(this, arguments); }`;
		}
		return snippet;
	}

	render(block: Block, target: string | Expression) {
		const snippet = this.get_snippet(block);

		const args = [];

		block.event_listeners.push(
			x`@listen(${target}, "${this.node.name}", ${snippet}, ${args})`
		);
	}
}
