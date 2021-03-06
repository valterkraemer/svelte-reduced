import list from '../utils/list';
import { ModuleFormat } from '../interfaces';
import { b, x } from 'code-red';
import { Identifier, ImportDeclaration } from 'estree';

const wrappers = { esm, cjs };

export default function create_module(
	program: any,
	format: ModuleFormat,
	name: Identifier,
	sveltePath = 'svelte',
	helpers: Array<{ name: string; alias: Identifier }>,
	globals: Array<{ name: string; alias: Identifier }>,
	imports: ImportDeclaration[]
) {
	const internal_path = `${sveltePath}/internal`;

	helpers.sort((a, b) => (a.name < b.name) ? -1 : 1);
	globals.sort((a, b) => (a.name < b.name) ? -1 : 1);

	if (format === 'esm') {
		return esm(program, name, sveltePath, internal_path, helpers, globals, imports);
	}

	if (format === 'cjs') return cjs(program, name, sveltePath, internal_path, helpers, globals, imports);

	throw new Error(`options.format is invalid (must be ${list(Object.keys(wrappers))})`);
}

function edit_source(source, sveltePath) {
	return source === 'svelte' || source.startsWith('svelte/')
		? source.replace('svelte', sveltePath)
		: source;
}

function get_internal_globals(
	globals: Array<{ name: string; alias: Identifier }>,
	helpers: Array<{ name: string; alias: Identifier }>
) {
	return globals.length > 0 && {
		type: 'VariableDeclaration',
		kind: 'const',
		declarations: [{
			type: 'VariableDeclarator',
			id: {
				type: 'ObjectPattern',
				properties: globals.map(g => ({
					type: 'Property',
					method: false,
					shorthand: false,
					computed: false,
					key: { type: 'Identifier', name: g.name },
					value: g.alias,
					kind: 'init'
				}))
			},
			init: helpers.find(({ name }) => name === 'globals').alias
		}]
	};
}

function esm(
	program: any,
	name: Identifier,
	sveltePath: string,
	internal_path: string,
	helpers: Array<{ name: string; alias: Identifier }>,
	globals: Array<{ name: string; alias: Identifier }>,
	imports: ImportDeclaration[]
) {
	const import_declaration = {
		type: 'ImportDeclaration',
		specifiers: helpers.map(h => ({
			type: 'ImportSpecifier',
			local: h.alias,
			imported: { type: 'Identifier', name: h.name }
		})),
		source: { type: 'Literal', value: internal_path }
	};

	const internal_globals = get_internal_globals(globals, helpers);

	// edit user imports
	imports.forEach(node => {
		node.source.value = edit_source(node.source.value, sveltePath);
	});

	program.body = b`
		${import_declaration}
		${internal_globals}
		${imports}

		${program.body}

		export default ${name};
	`;
}

function cjs(
	program: any,
	name: Identifier,
	sveltePath: string,
	internal_path: string,
	helpers: Array<{ name: string; alias: Identifier }>,
	globals: Array<{ name: string; alias: Identifier }>,
	imports: ImportDeclaration[]
) {
	const internal_requires = {
		type: 'VariableDeclaration',
		kind: 'const',
		declarations: [{
			type: 'VariableDeclarator',
			id: {
				type: 'ObjectPattern',
				properties: helpers.map(h => ({
					type: 'Property',
					method: false,
					shorthand: false,
					computed: false,
					key: { type: 'Identifier', name: h.name },
					value: h.alias,
					kind: 'init'
				}))
			},
			init: x`require("${internal_path}")`
		}]
	};

	const internal_globals = get_internal_globals(globals, helpers);

	const user_requires = imports.map(node => {
		const init = x`require("${edit_source(node.source.value, sveltePath)}")`;
		if (node.specifiers.length === 0) {
			return b`${init};`;
		}
		return {
			type: 'VariableDeclaration',
			kind: 'const',
			declarations: [{
				type: 'VariableDeclarator',
				id: node.specifiers[0].type === 'ImportNamespaceSpecifier'
					? { type: 'Identifier', name: node.specifiers[0].local.name }
					: {
						type: 'ObjectPattern',
						properties: node.specifiers.map(s => ({
							type: 'Property',
							method: false,
							shorthand: false,
							computed: false,
							key: s.type === 'ImportSpecifier' ? s.imported : { type: 'Identifier', name: 'default' },
							value: s.local,
							kind: 'init'
						}))
					},
				init
			}]
		};
	});

	program.body = b`
		"use strict";
		${internal_requires}
		${internal_globals}
		${user_requires}

		${program.body}

		exports.default = ${name};
	`;
}
