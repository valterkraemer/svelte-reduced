export default {
	test(assert, vars) {
		assert.deepEqual(vars, [
			{
				name: '$$props',
				export_name: null,
				injected: true,
				mutated: false,
				reassigned: false,
				referenced: true,
				writable: false
			}
		]);
	}
};
