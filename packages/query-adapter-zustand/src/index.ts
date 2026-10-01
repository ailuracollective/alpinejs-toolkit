// `./types` is deliberately absent, as in the sibling adapter: nothing in the
// barrel resolves to it, and `AdapterOptions` /
// `DEFAULT_ADAPTER_ZUSTAND_STORE_KEY` are duplicates of what `./plugin` already
// exports. See the note in that file. Nothing is re-exported from a peer either
// — `@ailura/alpinejs-query` owns the adapter contract and is imported for it
// where it is needed, not re-published from here.
export * from "./adapter";
export * from "./plugin";
export { default } from "./plugin";
