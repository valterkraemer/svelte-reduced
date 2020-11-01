export default {

	html: `
		<p>selected: a</p>

		<select>
			<option value='a'>a</option>
			<option value='b'>b</option>
			<option value='c'>c</option>
		</select>

		<p>selected: a</p>
	`,

	test({ assert, component, target }) {
		const select = target.querySelector('select');
		const options = [...target.querySelectorAll('option')];

		assert.equal(select.value, 'a');
		assert.ok(options[0].selected);
	}
};
