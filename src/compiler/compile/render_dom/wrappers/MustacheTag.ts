import Renderer from '../Renderer';
import Block from '../Block';
import Tag from './shared/Tag';
import Wrapper from './shared/Wrapper';
import MustacheTag from '../../nodes/MustacheTag';
import { x } from 'code-red';
import { Identifier } from 'estree';

export default class MustacheTagWrapper extends Tag {
	var: Identifier = { type: 'Identifier', name: 't' };

	constructor(renderer: Renderer, block: Block, parent: Wrapper, node: MustacheTag) {
		super(renderer, block, parent, node);
	}

	render(block: Block, parent_node: Identifier) {
		const { init } = this.rename_this_method(
			block,
			value => x`@set_data(${this.var}, ${value})`
		);

		block.add_element(
			this.var,
			x`@text(${init})`,
			parent_node
		);
	}
}
