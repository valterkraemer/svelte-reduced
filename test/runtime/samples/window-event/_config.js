export default {
	html: '<div>undefinedxundefined</div>',

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
