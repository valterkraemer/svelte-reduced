export default {
	html: '<input form="qux" list="quu" />',

	test({ assert, target }) {
		const div = target.querySelector('input');
		assert.equal(div.value, 'bar');
	}
};
