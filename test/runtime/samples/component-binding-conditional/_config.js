export default {

	html: `
		<p>y: bar</p>
		<p>y: bar</p>
	`,

	test({ assert, component, target }) {
		component.x = false;

		assert.htmlEqual(target.innerHTML, `
			<p>y: bar</p>
			<p>y: bar</p>
		`);
	}
};
