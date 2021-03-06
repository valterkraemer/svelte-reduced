import * as fs from 'fs';
import * as assert from 'assert';
import { svelte, loadConfig, tryToLoadJson } from '../helpers';

describe('validate', () => {
	fs.readdirSync(`${__dirname}/samples`).forEach(dir => {
		if (dir[0] === '.') return;

		// add .solo to a sample directory name to only run that test
		const solo = /\.solo/.test(dir);
		const skip = /\.skip/.test(dir);

		if (solo && process.env.CI) {
			throw new Error('Forgot to remove `solo: true` from test');
		}

		(solo ? it.only : skip ? it.skip : it)(dir, () => {
			const input = fs.readFileSync(`${__dirname}/samples/${dir}/input.svelte`, 'utf-8').replace(/\s+$/, '').replace(/\r/g, '');
			const expected_errors = tryToLoadJson(`${__dirname}/samples/${dir}/errors.json`);
			const options = tryToLoadJson(`${__dirname}/samples/${dir}/options.json`);

			let error;

			try {
				svelte.compile(input, {
					generate: false,
					...options
				});
			} catch (e) {
				error = e;
			}

			const expected = expected_errors && expected_errors[0];

			if (error || expected) {
				if (error && !expected) {
					throw error;
				}

				if (expected && !error) {
					throw new Error(`Expected an error: ${expected.message}`);
				}

				try {
					assert.equal(error.code, expected.code);
					assert.equal(error.message, expected.message);
					assert.deepEqual(error.start, expected.start);
					assert.deepEqual(error.end, expected.end);
					assert.equal(error.pos, expected.pos);
				} catch (e) {
					console.error(error); // eslint-disable-line no-console
					throw e;
				}
			}
		});
	});
});
