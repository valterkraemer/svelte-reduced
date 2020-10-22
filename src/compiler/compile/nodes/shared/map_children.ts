import Comment from '../Comment';
import Element from '../Element';
import IfBlock from '../IfBlock';
import InlineComponent from '../InlineComponent';
import MustacheTag from '../MustacheTag';
import Text from '../Text';
import Window from '../Window';
import { TemplateNode } from '../../../interfaces';

function get_constructor(type) {
	switch (type) {
		case 'Comment': return Comment;
		case 'Element': return Element;
		case 'IfBlock': return IfBlock;
		case 'InlineComponent': return InlineComponent;
		case 'MustacheTag': return MustacheTag;
		case 'Text': return Text;
		case 'Window': return Window;
		default: throw new Error(`Not implemented: ${type}`);
	}
}

export default function map_children(component, parent, scope, children: TemplateNode[]) {
	let last = null;
	let ignores = [];

	return children.map(child => {
		const constructor = get_constructor(child.type);

		const use_ignores = child.type !== 'Text' && child.type !== 'Comment' && ignores.length;

		if (use_ignores) component.push_ignores(ignores);
		const node = new constructor(component, parent, scope, child);
		if (use_ignores) component.pop_ignores(), ignores = [];

		if (node.type === 'Comment' && node.ignores.length) {
			ignores.push(...node.ignores);
		}

		if (last) last.next = node;
		node.prev = last;
		last = node;

		return node;
	});
}
