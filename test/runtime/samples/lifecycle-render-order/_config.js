import order from './order.js';

export default {

	test({ assert }) {
		assert.deepEqual(order, [
			'beforeUpdate',
			'render',
			'onMount',
			'afterUpdate'
		]);

		order.length = 0;
	}
};
