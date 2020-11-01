export default {

	html: `
		<button>+1</button>
		<p>count: 0</p>
	`,

	async test({ assert, component, target, window }) {
		const click = new window.MouseEvent('click');
		const button = target.querySelector('button');

		await button.dispatchEvent(click);

		assert.equal(component.x, 1);
		assert.htmlEqual(target.innerHTML, `
			<button>+1</button>
			<p>count: 1</p>
		`);

		await button.dispatchEvent(click);

		assert.equal(component.x, 2);
		assert.htmlEqual(target.innerHTML, `
			<button>+1</button>
			<p>count: 2</p>
		`);
	}
};
