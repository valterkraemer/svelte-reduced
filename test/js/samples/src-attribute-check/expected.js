/* generated by Svelte vX.Y.Z */
import {
	SvelteComponent,
	attr,
	claim_element,
	claim_space,
	detach,
	element,
	init,
	insert,
	safe_not_equal,
	space
} from "svelte/internal";

function create_fragment(ctx) {
	let img0;
	let img0_src_value;
	let t;
	let img1;
	let img1_src_value;

	return {
		c() {
			img0 = element("img");
			t = space();
			img1 = element("img");
			this.h();
		},
		l(nodes) {
			img0 = claim_element(nodes, "IMG", { alt: true, src: true });
			t = claim_space(nodes);
			img1 = claim_element(nodes, "IMG", { alt: true, src: true });
			this.h();
		},
		h() {
			attr(img0, "alt", "potato");
			if (img0.src !== (img0_src_value = /*url*/ ctx[0])) attr(img0, "src", img0_src_value);
			attr(img1, "alt", "potato");
			if (img1.src !== (img1_src_value = "" + (/*slug*/ ctx[1] + ".jpg"))) attr(img1, "src", img1_src_value);
		},
		m(target, anchor) {
			insert(target, img0, anchor);
			insert(target, t, anchor);
			insert(target, img1, anchor);
		},
		p(ctx, [dirty]) {
			if (dirty & /*url*/ 1 && img0.src !== (img0_src_value = /*url*/ ctx[0])) {
				attr(img0, "src", img0_src_value);
			}

			if (dirty & /*slug*/ 2 && img1.src !== (img1_src_value = "" + (/*slug*/ ctx[1] + ".jpg"))) {
				attr(img1, "src", img1_src_value);
			}
		},
		d(detaching) {
			if (detaching) detach(img0);
			if (detaching) detach(t);
			if (detaching) detach(img1);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { url } = $$props;
	let { slug } = $$props;

	$$self.$$set = $$props => {
		if ("url" in $$props) $$invalidate(0, url = $$props.url);
		if ("slug" in $$props) $$invalidate(1, slug = $$props.slug);
	};

	return [url, slug];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { url: 0, slug: 1 });
	}
}

export default Component;
