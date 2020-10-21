export default {
	// This is a bit of a funny one — there's no equivalent attribute,
	// so it can't be server-rendered

	props: {
		indeterminate: true
	},

	html: `
		<input type='checkbox'>
	`,

	test({ assert, component, target }) {
		const input = target.querySelector('input');

		assert.ok(input.indeterminate);
		component.indeterminate = false;
		assert.ok(!input.indeterminate);
	}
};
