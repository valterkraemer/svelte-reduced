export function string_literal(data: string) {
	return {
		type: 'Literal',
		value: data
	};
}

const escaped = {
	'"': '&quot;',
	"'": '&#39;',
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;'
};

export function escape_html(html) {
	return String(html).replace(/["'&<>]/g, match => escaped[match]);
}
