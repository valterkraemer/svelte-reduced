import read_expression from '../read/expression';
import read_script from '../read/script';
import read_style from '../read/style';
import { is_void } from '../../utils/names';
import { Parser } from '../index';
import { Directive, DirectiveType, TemplateNode, Text } from '../../interfaces';
import list from '../../utils/list';

// eslint-disable-next-line no-useless-escape
const valid_tag_name = /^\!?[a-zA-Z]{1,}:?[a-zA-Z0-9\-]*/;

const meta_tags = new Map([
	['svelte:window', 'Window']
]);

const valid_meta_tags = Array.from(meta_tags.keys());

const specials = new Map([
	[
		'script',
		{
			read: read_script,
			property: 'js'
		}
	],
	[
		'style',
		{
			read: read_style,
			property: 'css'
		}
	]
]);

export default function tag(parser: Parser) {
	const start = parser.index++;

	const parent = parser.current();

	const is_closing_tag = parser.eat('/');

	const name = read_tag_name(parser);

	if (meta_tags.has(name)) {
		const slug = meta_tags.get(name).toLowerCase();
		if (is_closing_tag) {
			if (
				(name === 'svelte:window' || name === 'svelte:body') &&
				parser.current().children.length
			) {
				parser.error({
					code: `invalid-${slug}-content`,
					message: `<${name}> cannot have children`
				});
			}
		} else {
			if (name in parser.meta_tags) {
				parser.error({
					code: `duplicate-${slug}`,
					message: `A component can only have one <${name}> tag`
				});
			}

			if (parser.stack.length > 1) {
				parser.error({
					code: `invalid-${slug}-placement`,
					message: `<${name}> tags cannot be inside elements or blocks`
				});
			}

			parser.meta_tags[name] = true;
		}
	}

	const type = meta_tags.has(name)
		? meta_tags.get(name)
		: (/[A-Z]/.test(name[0])) ? 'InlineComponent'
			: 'Element';

	const element: TemplateNode = {
		start,
		end: null, // filled in later
		type,
		name,
		attributes: [],
		children: []
	};

	parser.allow_whitespace();

	if (is_closing_tag) {
		if (is_void(name)) {
			parser.error({
				code: 'invalid-void-content',
				message: `<${name}> is a void element and cannot have children, or a closing tag`
			});
		}

		parser.eat('>', true);

		// close any elements that don't have their own closing tags, e.g. <div><p></div>
		if (parent.name !== name) {
			const message = `</${name}> attempted to close an element that was not open`;
			parser.error({
				code: 'invalid-closing-tag',
				message
			});
		}

		parent.end = parser.index;
		parser.stack.pop();

		return;
	}

	const unique_names: Set<string> = new Set();

	let attribute;
	while ((attribute = read_attribute(parser, unique_names))) {
		element.attributes.push(attribute);
		parser.allow_whitespace();
	}

	// special cases – top-level <script> and <style>
	if (specials.has(name) && parser.stack.length === 1) {
		const special = specials.get(name);

		parser.eat('>', true);
		const content = special.read(parser, start, element.attributes);
		if (content) parser[special.property].push(content);
		return;
	}

	parser.current().children.push(element);

	const self_closing = parser.eat('/') || is_void(name);

	parser.eat('>', true);

	if (self_closing) {
		// don't push self-closing elements onto the stack
		element.end = parser.index;
	} else if (name === 'textarea') {
		// special case
		element.children = read_sequence(
			parser,
			() =>
				parser.template.slice(parser.index, parser.index + 11) === '</textarea>'
		);
		parser.read(/<\/textarea>/);
		element.end = parser.index;
	} else if (name === 'script' || name === 'style') {
		// special case
		const start = parser.index;
		const data = parser.read_until(new RegExp(`</${name}>`));
		const end = parser.index;
		element.children.push({ start, end, type: 'Text', data });
		parser.eat(`</${name}>`, true);
		element.end = parser.index;
	} else {
		parser.stack.push(element);
	}
}

function read_tag_name(parser: Parser) {
	const name = parser.read_until(/(\s|\/|>)/);

	if (meta_tags.has(name)) return name;

	if (name.startsWith('svelte:')) {
		const message = `Valid <svelte:...> tag names are ${list(valid_meta_tags)}`;

		parser.error({
			code: 'invalid-tag-name',
			message
		});
	}

	if (!valid_tag_name.test(name)) {
		parser.error({
			code: 'invalid-tag-name',
			message: 'Expected valid tag name'
		});
	}

	return name;
}

function read_attribute(parser: Parser, unique_names: Set<string>) {
	const start = parser.index;

	function check_unique(name: string) {
		if (unique_names.has(name)) {
			parser.error({
				code: 'duplicate-attribute',
				message: 'Attributes need to be unique'
			});
		}
		unique_names.add(name);
	}

	if (parser.eat('{')) {
		parser.allow_whitespace();

		const value_start = parser.index;

		const name = parser.read_identifier();
		parser.allow_whitespace();
		parser.eat('}', true);

		check_unique(name);

		return {
			start,
			end: parser.index,
			type: 'Attribute',
			name,
			value: [{
				start: value_start,
				end: value_start + name.length,
				type: 'AttributeShorthand',
				expression: {
					start: value_start,
					end: value_start + name.length,
					type: 'Identifier',
					name
				}
			}]
		};
	}

	// eslint-disable-next-line no-useless-escape
	const name = parser.read_until(/[\s=\/>"']/);
	if (!name) return null;

	let end = parser.index;

	parser.allow_whitespace();

	const colon_index = name.indexOf(':');
	const type = colon_index !== -1 && get_directive_type(name.slice(0, colon_index));

	let value: any[] | true = true;
	if (parser.eat('=')) {
		parser.allow_whitespace();
		value = read_attribute_value(parser);
		end = parser.index;
	} else if (parser.match_regex(/["']/)) {
		parser.error({
			code: 'unexpected-token',
			message: 'Expected ='
		});
	}

	if (type) {
		const directive_name = name.slice(colon_index + 1);

		if (type === 'Binding') {
			check_unique(directive_name);
		} else if (type !== 'EventHandler') {
			check_unique(name);
		}

		if (value[0]) {
			if ((value as any[]).length > 1 || value[0].type === 'Text') {
				parser.error({
					code: 'invalid-directive-value',
					message: 'Directive value must be a JavaScript expression enclosed in curly braces'
				});
			}
		}

		const directive: Directive = {
			start,
			end,
			type,
			name: directive_name,
			expression: (value[0] && value[0].expression) || null
		};

		if (!directive.expression && (type === 'Binding' || type === 'Class')) {
			directive.expression = {
				start: directive.start + colon_index + 1,
				end: directive.end,
				type: 'Identifier',
				name: directive.name
			} as any;
		}

		return directive;
	}

	check_unique(name);

	return {
		start,
		end,
		type: 'Attribute',
		name,
		value
	};
}

function get_directive_type(name: string): DirectiveType {
	if (name === 'bind') return 'Binding';
	if (name === 'class') return 'Class';
	if (name === 'on') return 'EventHandler';
}

function read_attribute_value(parser: Parser) {
	const quote_mark = parser.eat("'") ? "'" : parser.eat('"') ? '"' : null;

	const regex = (
		quote_mark === "'" ? /'/ :
			quote_mark === '"' ? /"/ :
				/(\/>|[\s"'=<>`])/
	);

	const value = read_sequence(parser, () => !!parser.match_regex(regex));

	if (quote_mark) parser.index += 1;
	return value;
}

function read_sequence(parser: Parser, done: () => boolean): TemplateNode[] {
	let current_chunk: Text = {
		start: parser.index,
		end: null,
		type: 'Text',
		raw: '',
		data: null
	};

	function flush() {
		if (current_chunk.raw) {
			current_chunk.data = current_chunk.raw;
			current_chunk.end = parser.index;
			chunks.push(current_chunk);
		}
	}

	const chunks: TemplateNode[] = [];

	while (parser.index < parser.template.length) {
		const index = parser.index;

		if (done()) {
			flush();
			return chunks;
		} else if (parser.eat('{')) {
			flush();

			parser.allow_whitespace();
			const expression = read_expression(parser);
			parser.allow_whitespace();
			parser.eat('}', true);

			chunks.push({
				start: index,
				end: parser.index,
				type: 'MustacheTag',
				expression
			});

			current_chunk = {
				start: parser.index,
				end: null,
				type: 'Text',
				raw: '',
				data: null
			};
		} else {
			current_chunk.raw += parser.template[parser.index++];
		}
	}

	parser.error({
		code: 'unexpected-eof',
		message: 'Unexpected end of input'
	});
}
