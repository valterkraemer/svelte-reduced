import read_expression from '../read/expression';
import { closing_tag_omitted } from '../utils/html';
import { whitespace } from '../../utils/patterns';
import { trim_start, trim_end } from '../../utils/trim';
import { to_string } from '../utils/node';
import { Parser } from '../index';
import { TemplateNode } from '../../interfaces';

function trim_whitespace(block: TemplateNode, trim_before: boolean, trim_after: boolean) {
	if (!block.children || block.children.length === 0) return;

	const first_child = block.children[0];
	const last_child = block.children[block.children.length - 1];

	if (first_child.type === 'Text' && trim_before) {
		first_child.data = trim_start(first_child.data);
		if (!first_child.data) block.children.shift();
	}

	if (last_child.type === 'Text' && trim_after) {
		last_child.data = trim_end(last_child.data);
		if (!last_child.data) block.children.pop();
	}

	if (block.else) {
		trim_whitespace(block.else, trim_before, trim_after);
	}

	if (first_child.elseif) {
		trim_whitespace(first_child, trim_before, trim_after);
	}
}

export default function mustache(parser: Parser) {
	const start = parser.index;
	parser.index += 1;

	parser.allow_whitespace();

	// {/if}, {/each} or {/key}
	if (parser.eat('/')) {
		let block = parser.current();
		let expected;

		if (closing_tag_omitted(block.name)) {
			block.end = start;
			parser.stack.pop();
			block = parser.current();
		}

		if (block.type === 'ElseBlock') {
			block.end = start;
			parser.stack.pop();
			block = parser.current();
		}

		if (block.type === 'IfBlock') {
			expected = 'if';
		} else {
			parser.error({
				code: 'unexpected-block-close',
				message: 'Unexpected block closing tag'
			});
		}

		parser.eat(expected, true);
		parser.allow_whitespace();
		parser.eat('}', true);

		while (block.elseif) {
			block.end = parser.index;
			parser.stack.pop();
			block = parser.current();

			if (block.else) {
				block.else.end = start;
			}
		}

		// strip leading/trailing whitespace as necessary
		const char_before = parser.template[block.start - 1];
		const char_after = parser.template[parser.index];
		const trim_before = !char_before || whitespace.test(char_before);
		const trim_after = !char_after || whitespace.test(char_after);

		trim_whitespace(block, trim_before, trim_after);

		block.end = parser.index;
		parser.stack.pop();
	} else if (parser.eat(':else')) {
		if (parser.eat('if')) {
			parser.error({
				code: 'invalid-elseif',
				message: "'elseif' should be 'else if'"
			});
		}

		parser.allow_whitespace();

		// :else if
		if (parser.eat('if')) {
			const block = parser.current();
			if (block.type !== 'IfBlock') {
				parser.error({
					code: 'invalid-elseif-placement',
					message: parser.stack.some(block => block.type === 'IfBlock')
						? `Expected to close ${to_string(block)} before seeing {:else if ...} block`
						: 'Cannot have an {:else if ...} block outside an {#if ...} block'
				});
			}

			parser.require_whitespace();

			const expression = read_expression(parser);

			parser.allow_whitespace();
			parser.eat('}', true);

			block.else = {
				start: parser.index,
				end: null,
				type: 'ElseBlock',
				children: [
					{
						start: parser.index,
						end: null,
						type: 'IfBlock',
						elseif: true,
						expression,
						children: []
					}
				]
			};

			parser.stack.push(block.else.children[0]);
		}

		// :else
		else {
			const block = parser.current();
			if (block.type !== 'IfBlock') {
				parser.error({
					code: 'invalid-else-placement',
					message: parser.stack.some(block => block.type === 'IfBlock')
						? `Expected to close ${to_string(block)} before seeing {:else} block`
						: 'Cannot have an {:else} block outside an {#if ...} block'
				});
			}

			parser.allow_whitespace();
			parser.eat('}', true);

			block.else = {
				start: parser.index,
				end: null,
				type: 'ElseBlock',
				children: []
			};

			parser.stack.push(block.else);
		}
	} else if (parser.eat('#')) {
		// {#if foo}
		let type;

		if (parser.eat('if')) {
			type = 'IfBlock';
		} else {
			parser.error({
				code: 'expected-block-type',
				message: 'Expected if'
			});
		}

		parser.require_whitespace();

		const expression = read_expression(parser);

		const block: TemplateNode = {
			start,
			end: null,
			type,
			expression,
			children: []
		};

		parser.allow_whitespace();

		parser.eat('}', true);

		parser.current().children.push(block);
		parser.stack.push(block);
	} else if (parser.eat('@html')) {
		// {@html content} tag
		parser.require_whitespace();

		const expression = read_expression(parser);

		parser.allow_whitespace();
		parser.eat('}', true);

		parser.current().children.push({
			start,
			end: parser.index,
			type: 'RawMustacheTag',
			expression
		});
	} else if (parser.eat('@debug')) {
		let identifiers;

		// Implies {@debug} which indicates "debug all"
		if (parser.read(/\s*}/)) {
			identifiers = [];
		} else {
			const expression = read_expression(parser);

			identifiers = expression.type === 'SequenceExpression'
				? expression.expressions
				: [expression];

			identifiers.forEach(node => {
				if (node.type !== 'Identifier') {
					parser.error({
						code: 'invalid-debug-args',
						message: '{@debug ...} arguments must be identifiers, not arbitrary expressions'
					}, node.start);
				}
			});

			parser.allow_whitespace();
			parser.eat('}', true);
		}

		parser.current().children.push({
			start,
			end: parser.index,
			type: 'DebugTag',
			identifiers
		});
	} else {
		const expression = read_expression(parser);

		parser.allow_whitespace();
		parser.eat('}', true);

		parser.current().children.push({
			start,
			end: parser.index,
			type: 'MustacheTag',
			expression
		});
	}
}
