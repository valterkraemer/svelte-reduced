import exampleGroups from '../../examples/all';

export const sections = exampleGroups;

export const examples = exampleGroups.map(group => group.examples).flat();

export function get_example(slug) {
	return examples.find(example => example.slug === slug);
}
