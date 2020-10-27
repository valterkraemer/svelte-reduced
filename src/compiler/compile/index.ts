import Stats from '../Stats';
import parse from '../parse/index';
import render_dom from './render_dom/index';
import { CompileOptions } from '../interfaces';
import Component from './Component';
import get_name_from_filename from './utils/get_name_from_filename';

export default function compile(source: string, options: CompileOptions = {}) {
	options = Object.assign({ generate: 'dom' }, options);

	const stats = new Stats();

	stats.start('parse');
	const ast = parse(source, options);
	stats.stop('parse');

	stats.start('create component');
	const component = new Component(
		ast,
		source,
		options.name || get_name_from_filename(options.filename) || 'Component',
		options,
		stats
	);
	stats.stop('create component');

	const result = options.generate === false
		? null
		: render_dom(component, options);

	return component.generate(result);
}
