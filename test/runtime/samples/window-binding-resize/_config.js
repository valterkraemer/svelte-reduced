export default {
	html: '<div>1024x768</div>',

	before_test() {
		Object.defineProperties(window, {
			innerWidth: {
				value: 1024,
				configurable: true
			},
			innerHeight: {
				value: 768,
				configurable: true
			}
		});
	},

	async test({ assert, component, target, window }) {
		const event = new window.Event('resize');

		Object.defineProperties(window, {
			innerWidth: {
				value: 567,
				configurable: true
			},
			innerHeight: {
				value: 456,
				configurable: true
			}
		});

		await window.dispatchEvent(event);

		assert.htmlEqual(target.innerHTML, `
			<div>567x456</div>
		`);
	}
};
