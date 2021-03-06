import { Node, Program } from 'estree';

interface BaseNode {
	start: number;
	end: number;
	type: string;
	children?: TemplateNode[];
	[prop_name: string]: any;
}

export interface Fragment extends BaseNode {
	type: 'Fragment';
	children: TemplateNode[];
}

export interface Text extends BaseNode {
	type: 'Text';
	data: string;
}

export interface MustacheTag extends BaseNode {
	type: 'MustacheTag';
	expression: Node;
}

export type DirectiveType = 'Binding'
| 'Class'
| 'EventHandler';

interface BaseDirective extends BaseNode {
	type: DirectiveType;
	expression: null | Node;
	name: string;
}

export type Directive = BaseDirective;

export type TemplateNode = Text
| MustacheTag
| BaseNode
| Directive;

export interface Parser {
	readonly template: string;
	readonly filename?: string;

	index: number;
	stack: Node[];

	html: Node;
	css: Node;
	js: Node;
	meta_tags: {};
}

export interface Script extends BaseNode {
	type: 'Script';
	context: string;
	content: Program;
}

export interface Style extends BaseNode {
	type: 'Style';
	attributes: any[]; // TODO
	children: any[]; // TODO add CSS node types
	content: {
		start: number;
		end: number;
		styles: string;
	};
}

export interface Ast {
	html: TemplateNode;
	css: Style;
	instance: Script;
}

export type ModuleFormat = 'esm' | 'cjs';

export interface CompileOptions {
	format?: ModuleFormat;
	name?: string;
	filename?: string;
	generate?: 'dom' | false;

	sveltePath?: string;

	accessors?: boolean;
	css?: boolean;
}

export interface ParserOptions {
	filename?: string;
}

export interface Visitor {
	enter: (node: Node) => void;
	leave?: (node: Node) => void;
}

export interface Var {
	name: string;
	export_name?: string; // the `bar` in `export { foo as bar }`
	injected?: boolean;
	module?: boolean;
	mutated?: boolean;
	reassigned?: boolean;
	referenced?: boolean;  // referenced from template scope
	writable?: boolean;

	// used internally, but not exposed
	global?: boolean;
	internal?: boolean; // event handlers, bindings
	initialised?: boolean;
	hoistable?: boolean;
	is_reactive_dependency?: boolean;
	imported?: boolean;
}

export interface CssResult {
	code: string;
}
