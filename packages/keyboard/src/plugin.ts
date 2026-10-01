import { createDirectiveBinding, createValueReader } from "@ailura/alpinejs-core/directives";
import { guardDirective, guardStore } from "@ailura/alpinejs-core/guards";
import { resolveStoreKey } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { createKeyboardController } from "./controller";
import type {
  KeyboardDirectiveOptions,
  KeyboardPluginOptions,
  KeyboardStore,
  ShortcutHandler,
  ShortcutRegistrationOptions,
  ShortcutScope,
} from "./types";
import { DEFAULT_KEYBOARD_DIRECTIVE_KEY, DEFAULT_KEYBOARD_STORE_KEY } from "./types";

const packageName = "@ailura/alpinejs-keyboard";

export function keyboardPlugin(options: KeyboardPluginOptions = {}): (alpine: Alpine) => void {
  const storeKey = resolveStoreKey(options, DEFAULT_KEYBOARD_STORE_KEY);
  const directiveKey = options.directiveKey ?? DEFAULT_KEYBOARD_DIRECTIVE_KEY;

  return function registerKeyboard(alpine: Alpine): void {
    // The ternary is redundant — both arms are the same call — but it is not
    // mine to simplify: leave it and the surrounding shape as they are.
    const controller = options.shortcuts
      ? createKeyboardController(options.options)
      : createKeyboardController(options.options);
    // Registered before mount, so the `register` events below reach a listener
    // that already exists — and so the initial `sync()` at the bottom already
    // sees them without a second pass.
    for (const s of options.shortcuts ?? []) controller.register(s.shortcut, s.handler, s.options);
    if (controller.lifecycle === "idle") controller.mount();

    // Alpine's `store()` wraps the value in a reactive proxy, but a *getter*
    // that reads a private field on the plain controller registers no
    // dependency: the template tracks a key that nothing ever writes, so
    // `activeScopes` and `suspendedScopes` stayed frozen at their first read and
    // the demo's four scope buttons changed nothing visible. `commands` happened
    // to look right only because registrations happen in `x-init`, before the
    // first render.
    //
    // So the state lives in a reactive `view` that `sync()` writes.
    const maybeReactive = (alpine as unknown as { reactive?: (v: unknown) => unknown }).reactive;
    const view = (maybeReactive ? maybeReactive({}) : {}) as Record<string, unknown>;

    // Methods are closures over the controller so `this` never resolves to the
    // reactive proxy.
    view["register"] = (sc: string, h: ShortcutHandler, o?: ShortcutRegistrationOptions) =>
      controller.register(sc, h, o);
    view["unregister"] = (id: string) => controller.unregister(id);
    view["activateScope"] = (s: ShortcutScope) => controller.activateScope(s);
    view["deactivateScope"] = (s: ShortcutScope) => controller.deactivateScope(s);
    view["suspendScope"] = (s: ShortcutScope) => controller.suspendScope(s);
    view["resumeScope"] = (s: ShortcutScope) => controller.resumeScope(s);
    view["isScopeActive"] = (s: ShortcutScope) => controller.isScopeActive(s);
    view["isScopeSuspended"] = (s: ShortcutScope) => controller.isScopeSuspended(s);
    view["handleKeydown"] = (e: KeyboardEvent) => controller.handleKeydown(e);
    view["destroy"] = () => {
      controller.destroy();
      // `destroy()` drains the cleanup stack, and these subscriptions live on
      // it — so the event that would normally refresh the view never arrives.
      // Sync once more, or the store would keep advertising a registry the
      // controller has already released.
      sync();
    };

    // `scope:change` covers every scope transition; `register`/`unregister`
    // cover the command list.
    const sync = (): void => {
      view["activeScopes"] = controller.activeScopes;
      view["suspendedScopes"] = controller.suspendedScopes;
      view["commands"] = controller.commands;
    };
    controller.on("scope:change", sync);
    controller.on("register", sync);
    controller.on("unregister", sync);

    // Never hand out an empty store: a host may read it before any event. This
    // is also what makes the store correct if a consumer reads it before
    // `Alpine.start()`.
    sync();

    guardStore(alpine, storeKey, view as unknown as KeyboardStore, packageName);

    // x-keyboard="'mod+s -> save()'": a shortcut bound to its element's life.
    //
    // `register()` returns an unregister disposer and the store surface has no
    // way to invoke it later — the docs tell you to keep it, and the playground
    // had to *defeat* it. Alpine compiles `x-init` to `let __result = <expr>`
    // and then invokes `__result` when it is a function, so a list of
    // `register()` calls silently disposed the first shortcut on mount and a
    // multi-statement `x-init` needed an IIFE to survive at all. That trap is
    // structurally impossible here: a directive callback never assigns its
    // expression's value.
    //
    // `cleanup()` then releases the registration when the element leaves the
    // tree, which no store call can do. The `window` keydown listener stays
    // global — only the *registration* is element-bound — so this composes with
    // the existing scope system rather than fighting it.
    guardDirective(
      alpine,
      directiveKey,
      (el, { expression, modifiers }, utilities) => {
        const binding = createDirectiveBinding();
        utilities.cleanup(binding.release);

        // The single modifier is the scope: `x-keyboard.editor="'mod+s -> save()'"`.
        // The registration id is derived from the scope AND the shortcut, so two
        // shortcuts in one scope coexist while re-entering the page
        // re-registers the same id instead of throwing
        // `ERR_KEYBOARD_DUPLICATE_ID` — the manual unregister pass the
        // playground needed on every visit.
        const [scope] = modifiers;

        let off: (() => void) | null = null;
        const release = (): void => {
          off?.();
          off = null;
        };

        createValueReader<KeyboardDirectiveOptions | string>(
          expression,
          { evaluateLater: utilities.evaluateLater, effect: utilities.effect },
          (next: KeyboardDirectiveOptions | string) => {
            release();
            if (next === undefined || next === null || next === "") return;

            // `"mod+s -> save()"` — the documented shorthand. The `->` split
            // happens before Alpine evaluates anything, so the right side is
            // evaluated in the component's own scope exactly like `x-on`.
            const shorthand = typeof next === "string" ? next : "";
            const arrow = shorthand.indexOf("->");
            const shortcut = (arrow >= 0 ? shorthand.slice(0, arrow) : shorthand).trim();
            if (!shortcut) return;

            const scopedOptions = scope ? { scope: [scope] as never } : {};
            // Stable and unique: two different shortcuts in one scope differ
            // here, and re-entering the page produces the same string.
            const derivedId = scope
              ? `x-keyboard.${scope}.${shortcut.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
              : undefined;

            if (arrow >= 0) {
              const body = shorthand.slice(arrow + 2).trim();
              const get = utilities.evaluateLater(body);
              if (derivedId) controller.unregister(derivedId);
              off = controller.register(
                shortcut,
                () => {
                  // The receiver is a sink: the handler runs with the merged
                  // data scope as `this` and no params, exactly like
                  // `x-on:click` — passing the function to the receiver
                  // instead would call it with no `this` and no arguments.
                  get(() => {}, { scope: {} as never, params: [] as never });
                },
                { ...scopedOptions, ...(derivedId ? { id: derivedId } : {}) }
              );
              return;
            }

            // The object form carries the handler as a value, so no expression
            // splitting is involved.
            const config = next as KeyboardDirectiveOptions;
            const id = config.id ?? derivedId;
            if (id) controller.unregister(id);
            off = controller.register(shortcut, config.handler, {
              ...config,
              ...scopedOptions,
              ...(id ? { id } : {}),
            });
          }
        );
        binding.add(() => release());
      },
      packageName
    );
  };
}

export default keyboardPlugin;
