export default {
	test(assert, vars) {
		assert.deepEqual(vars, [
			{
				name: 'a',
				injected: false,
				export_name: null,
				mutated: false,
				reassigned: false,
				referenced: true,
				writable: true
			},
			{
				name: 'b',
				injected: true,
				export_name: null,
				mutated: false,
				reassigned: true,
				referenced: true,
				writable: true
			}
		]);
	}
};
