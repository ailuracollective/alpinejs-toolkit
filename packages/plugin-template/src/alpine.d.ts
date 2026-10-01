/**
 * Registers the `pluginTemplate` store on Alpine's global store registry so
 * `Alpine.store('pluginTemplate')` returns a typed store instead of `unknown`.
 *
 * The community types (`@types/alpinejs`) model `Alpine.Stores` as an open
 * index signature, so names registered by plugins resolve to `unknown`
 * without this augmentation.
 */
import type { PluginTemplateStore } from "./index";

declare module "alpinejs" {
  interface Stores {
    pluginTemplate: PluginTemplateStore;
  }
}
