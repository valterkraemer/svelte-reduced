import { TemplateNode } from '../../interfaces';

export function to_string(node: TemplateNode) {
	switch (node.type) {
		case 'IfBlock':
			return '{#if} block';
		case 'ElseBlock':
			return '{:else} block';
		case 'Element':
		case 'InlineComponent':
			return `<${node.name}> tag`;
		default:
			return node.type;
	}
}
