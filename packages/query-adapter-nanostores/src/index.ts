// `./types` is deliberately absent, as in the sibling adapters: nothing in the
// barrel resolves to it, and `AdapterOptions` /
// `DEFAULT_ADAPTER_NANOSTORES_STORE_KEY` are duplicates of what `./plugin`
// already exports. See the note in that file. Nothing is re-exported from a
// peer either — `@ailura/alpinejs-query` owns the adapter contract and
// `nanostores` owns the store type; both are imported where they are needed,
// not re-published from here. In particular this barrel does not re-export
// `atom`, `NanoStores`, `$nano` or `x-nano`: the atom type is a peer type, and
// the `$nano` / `x-nano` names belong to `@nanostores/alpine`, which this
// package does not depend on and does not register.
export * from "./adapter";
export * from "./plugin";
export { default } from "./plugin";
