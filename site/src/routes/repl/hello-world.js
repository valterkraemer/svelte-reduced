export default {
  relaxed: true,
  uid: "hello-world",
  name: "Hello world",
  files: [
    {
      name: "App.svelte",
      source:
        "<script>\n\tlet name = 'world';\n</script>\n\n<h1>Hello {name}!</h1>",
    },
  ],
  owner: null,
};
