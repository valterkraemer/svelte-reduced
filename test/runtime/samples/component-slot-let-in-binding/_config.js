export default {
	html: `
		<div>
			<label>1: <input></label>
			<label>2: <input></label>
			<label>3: <input></label>
		</div>
	`,

	async test({ assert, component, target, window }) {
		const inputs = target.querySelectorAll('input');

		inputs[2].value = 'd';
		await inputs[2].dispatchEvent(new window.Event('input'));

		assert.deepEqual(component.letters, ['a', 'b', 'd']);
	}
};
