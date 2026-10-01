// `./types` is deliberately absent: nothing in the barrel resolves to it, and
// `AdapterOptions` / `DEFAULT_ADAPTER_ALPINE_STORE_KEY` are duplicates of what
// `./plugin` already exports. See the note in that file.
export * from "./adapter";
export * from "./plugin";
export { default } from "./plugin";
