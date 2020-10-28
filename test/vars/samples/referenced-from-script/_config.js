export default {
	test(assert, vars) {
		assert.deepEqual(vars, [
			{
				name: 'i',
				export_name: null,
				injected: false,
				mutated: false,
				reassigned: false,
				referenced: false,
				writable: false
			},
			{
				name: 'j',
				export_name: null,
				injected: false,
				mutated: false,
				reassigned: false,
				referenced: false,
				writable: false
			},
			{
				name: 'k',
				export_name: null,
				injected: false,
				mutated: false,
				reassigned: false,
				referenced: false,
				writable: false
			},
			{
				name: 'a',
				export_name: null,
				injected: false,
				mutated: false,
				reassigned: true,
				referenced: false,
				writable: true
			},
			{
				name: 'b',
				export_name: null,
				injected: false,
				mutated: false,
				reassigned: false,
				referenced: false,
				writable: true
			},
			{
				name: 'c',
				export_name: null,
				injected: false,
				mutated: false,
				reassigned: false,
				referenced: false,
				writable: true
			},
			{
				name: 'd',
				export_name: null,
				injected: false,
				mutated: false,
				reassigned: false,
				referenced: false,
				writable: true
			},
			{
				name: 'e',
				export_name: null,
				injected: false,
				mutated: false,
				reassigned: false,
				referenced: false,
				writable: true
			},
			{
				name: 'f',
				export_name: 'f',
				injected: false,
				mutated: false,
				reassigned: false,
				referenced: false,
				writable: true
			},
			{
				name: 'g',
				export_name: null,
				injected: false,
				mutated: false,
				reassigned: false,
				referenced: false,
				writable: true
			},
			{
				name: 'h',
				export_name: null,
				injected: false,
				mutated: false,
				reassigned: true,
				referenced: false,
				writable: true
			},
			{
				name: 'foo',
				export_name: null,
				injected: false,
				mutated: false,
				reassigned: false,
				referenced: false,
				writable: false
			},
			{
				name: 'l',
				export_name: null,
				injected: false,
				mutated: false,
				reassigned: false,
				referenced: false,
				writable: false
			},
			{
				name: 'bar',
				export_name: 'bar',
				injected: false,
				mutated: false,
				reassigned: false,
				referenced: false,
				writable: false
			}
		]);
	}
};
