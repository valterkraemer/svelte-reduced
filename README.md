<img alt="Svelte reduced" src="site/static/svelte-logo-horizontal.svg" width="200">

# svelte-reduced

https://svelte-reduced.netlify.app

## Introduction

I find [Svelte](https://svelte.dev) really cool and wanted to know how it works. Found some good [articles](https://lihautan.com/the-svelte-compiler-handbook/) and [code examples](https://github.com/joshnuss/micro-svelte-compiler) but wanted more. I got lost in the [codebase](https://github.com/sveltejs/svelte) so decided to fork it and simplify it by removing features.

## Code reduction

About half is removed

|        | Before | After  |
| :----- | :----- | :----- |
| Files  | ~180   | ~90    |
| Lines  | ~20000 | ~9000  |

## Some of the removed features

- `{#each ...}`
- `{#key ...}`
- `{#await ...}`
- `use:action`
- `{@html ...}`
- `{@debug ...}`
- `<slot>`
- `<svelte:x>` elements
- `<script context="module">`
- `<select>` support
- `bind:this`
- `bind:group`
- `$$restProps`
- `getContext` / `setContext`
- `beforeUpdate` / `afterUpdate`
- `svelte/store`
- Spread {...} on attributes
- Transitions and animations
- Comments
- Sourcemaps
- Warnings
- SSR

For a more or less complete list check the [Git history](https://github.com/valterkraemer/svelte-reduced/commits/master).

## Running

`npm run dev:site`

This will compile the codebase and serve the site.

The site is heavily modified to better support playing around with this codebase (and be able to be exported). It now contains only a subset of the examples and the REPL.

The site hosted on https://svelte-reduced.netlify.app. Don't really know why you would want to use it, but it's there anyway.

## Tests

While removing features I used the existing tests to ensure that I didn't break other features. Number of tests went from ~3000 to ~500.

`npm run test`

## Folder structure

```
src
│
│  # Code used to compile the Svelte components
└──compiler
│  │  config.ts
│  │  index.ts
│  │  interfaces.ts
│  │
│  └──compile
│  │  │  Component.ts
│  │  │  create_module.ts
│  │  │  index.ts
│  │  │  internal_exports.ts
│  │  │
│  │  └──css
│  │  │    gather_possible_values.ts
│  │  │    interfaces.ts
│  │  │    Selector.ts
│  │  │    Stylesheet.ts
│  │  │
│  │  └──nodes
│  │  │  │  Attribute.ts
│  │  │  │  Binding.ts
│  │  │  │  Class.ts
│  │  │  │  Element.ts
│  │  │  │  ElseBlock.ts
│  │  │  │  EventHandler.ts
│  │  │  │  Fragment.ts
│  │  │  │  IfBlock.ts
│  │  │  │  InlineComponent.ts
│  │  │  │  interfaces.ts
│  │  │  │  MustacheTag.ts
│  │  │  │  Text.ts
│  │  │  │  Window.ts
│  │  │  │
│  │  │  └──shared
│  │  │       AbstractBlock.ts
│  │  │       Expression.ts
│  │  │       map_children.ts
│  │  │       Node.ts
│  │  │       Tag.ts
│  │  │       TemplateScope.ts
│  │  │
│  │  └──render_dom
│  │  │  │  Block.ts
│  │  │  │  index.ts
│  │  │  │  invalidate.ts
│  │  │  │  Renderer.ts
│  │  │  │
│  │  │  └──wrappers
│  │  │     │  Fragment.ts
│  │  │     │  IfBlock.ts
│  │  │     │  MustacheTag.ts
│  │  │     │  Text.ts
│  │  │     │  Window.ts
│  │  │     │
│  │  │     └──Element
│  │  │     │    Attribute.ts
│  │  │     │    Binding.ts
│  │  │     │    EventHandler.ts
│  │  │     │    index.ts
│  │  │     │    StyleAttribute.ts
│  │  │     │
│  │  │     └──InlineComponent
│  │  │     │    index.ts
│  │  │     │
│  │  │     └──shared
│  │  │          add_event_handlers.ts
│  │  │          is_dynamic.ts
│  │  │          Tag.ts
│  │  │          Wrapper.ts
│  │  │
│  │  └──utils
│  │       add_to_set.ts
│  │       flatten_reference.ts
│  │       get_name_from_filename.ts
│  │       get_object.ts
│  │       hash.ts
│  │       replace_object.ts
│  │       reserved_keywords.ts
│  │       scope.ts
│  │       string_to_member_expression.ts
│  │       stringify.ts
│  │
│  │  # Parses a .svelte component into html, css and script
│  └──parse
│  │  │  acorn.ts
│  │  │  index.ts
│  │  │
│  │  └──read
│  │  │    expression.ts
│  │  │    script.ts
│  │  │    style.ts
│  │  │
│  │  └──utils
│  │  │    node.ts
│  │  │
│  │  └──state
│  │       fragment.ts
│  │       mustache.ts
│  │       tag.ts
│  │       text.ts
│  │
│  └──utils
│       error.ts
│       full_char_code_at.ts
│       link.ts
│       list.ts
│       names.ts
│       nodes_match.ts
│       patterns.ts
│       trim.ts
│
│  # Functions used in the browser.
│  # Meaning that its possible to see these functions imported in the REPL's "JS output" tab
└──runtime
   │  index.ts
   │
   └──internal
        Component.ts
        dom.ts
        environment.ts
        globals.ts
        index.ts
        lifecycle.ts
        scheduler.ts
        utils.ts
```

## License

[MIT](LICENSE)
