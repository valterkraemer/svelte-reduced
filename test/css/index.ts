import * as fs from 'fs';
import { assert, env, svelte, setupHtmlEqual, shouldUpdateExpected } from '../helpers';

function try_require(file) {
	try {
		const mod = require(file);
		return mod.default || mod;
	} catch (err) {
		if (err.code !== 'MODULE_NOT_FOUND') throw err;
		return null;
	}
}

function create(code) {
	const fn = new Function('module', 'exports', 'require', code);

	const module = { exports: {} };
	fn(module, module.exports, id => {
		if (id === 'svelte') return require('../../index.js');
		if (id.startsWith('svelte/')) return require(id.replace('svelte', '../../'));

		return require(id);
	});

	return module.exports.default;
}

describe('css', () => {
	before(() => {
		setupHtmlEqual();
	});

	fs.readdirSync(`${__dirname}/samples`).forEach(dir => {
		if (dir[0] === '.') return;

		// add .solo to a sample directory name to only run that test
		const solo = /\.solo/.test(dir);
		const skip = /\.skip/.test(dir);

		if (solo && process.env.CI) {
			throw new Error('Forgot to remove `solo: true` from test');
		}

		(solo ? it.only : skip ? it.skip : it)(dir, () => {
			const config = try_require(`./samples/${dir}/_config.js`) || {};
			const input = fs
				.readFileSync(`${__dirname}/samples/${dir}/input.svelte`, 'utf-8')
				.replace(/\s+$/, '')
				.replace(/\r/g, '');

			const dom = svelte.compile(
				input,
				Object.assign(config.compileOptions || {}, { format: 'cjs' })
			);

			fs.writeFileSync(`${__dirname}/samples/${dir}/_actual.css`, dom.css.code);
			const expected = {
				html: read(`${__dirname}/samples/${dir}/expected.html`),
				css: read(`${__dirname}/samples/${dir}/expected.css`)
			};

			const actual_css = dom.css.code.replace(/svelte(-ref)?-[a-z0-9]+/g, (m, $1) => $1 ? m : 'svelte-xyz');
			try {
				assert.equal(actual_css, expected.css);
			} catch (error) {
				if (shouldUpdateExpected()) {
					fs.writeFileSync(`${__dirname}/samples/${dir}/expected.css`, actual_css);
					console.log(`Updated ${dir}/expected.css.`);
				} else {
					throw error;
				}
			}

			let ClientComponent;

			// we do this here, rather than in the expected.html !== null
			// block, to verify that valid code was generated
			try {
				ClientComponent = create(dom.js.code);
			} catch (err) {
				console.log(dom.js.code);
				throw err;
			}

			// verify that the right elements have scoping selectors
			if (expected.html !== null) {
				const window = env();

				// dom
				try {
					const target = window.document.querySelector('main');

					new ClientComponent({ target, props: config.props });
					const html = target.innerHTML;

					fs.writeFileSync(`${__dirname}/samples/${dir}/_actual.html`, html);

					const actual_html = html.replace(/svelte(-ref)?-[a-z0-9]+/g, (m, $1) => $1 ? m : 'svelte-xyz');
					assert.htmlEqual(actual_html, expected.html);

					window.document.head.innerHTML = ''; // remove added styles
				} catch (err) {
					console.log(dom.js.code);
					throw err;
				}
			}
		});
	});
});

function read(file) {
	try {
		return fs.readFileSync(file, 'utf-8');
	} catch (err) {
		return null;
	}
}
