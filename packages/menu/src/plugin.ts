import {
  bindProps,
  createDirectiveBinding,
  createValueReader,
} from "@ailura/alpinejs-core/directives";
import { guardDirective, guardMagic, guardStore } from "@ailura/alpinejs-core/guards";
import { generateId } from "@ailura/alpinejs-core/ids";
import { readAlpineStore, resolvePluginKeys } from "@ailura/alpinejs-core/registration";
import { syncRecordFromSnapshot } from "@ailura/alpinejs-core/sync";
import type { Alpine } from "alpinejs";

import { MenuController } from "./controller";
import {
  type CreateMenuOptions,
  DEFAULT_MENU_DIRECTIVE_KEY,
  DEFAULT_MENU_MAGIC_KEY,
  type MenuOptions,
  DEFAULT_MENU_STORE_KEY,
  type MenuPluginCallback,
  type MenuStore,
} from "./types";

const packageName = "@ailura/alpinejs-menu";

/**
 * One directive, three roles, chosen by modifier — `x-menu` (the panel),
 * `x-menu.trigger`, `x-menu.item`. See the `guardDirective` call below for why
 * they cannot be three keys.
 */
export function menuPlugin(options: CreateMenuOptions = {}): MenuPluginCallback {
  const { storeKey, magicKey } = resolvePluginKeys(
    options,
    DEFAULT_MENU_STORE_KEY,
    DEFAULT_MENU_MAGIC_KEY
  );
  const directiveKey = options.directiveKey ?? DEFAULT_MENU_DIRECTIVE_KEY;

  return function registerMenu(alpine: Alpine): void {
    const controller = new MenuController({
      id: options.id,
      exclusive: options.exclusive,
      scroll: options.scroll,
    });
    const base = controller.toStore();

    // Everything a template binds is answered from the STORE's reactive
    // `instances`, never from the controller. The controller's own copy is
    // private and untracked, so a predicate reading it registers no dependency:
    // `x-bind:aria-hidden="$store.menu.menuHidden(id)"` evaluated once and never
    // re-ran, leaving the menu `aria-hidden` while it was open. Reading
    // `this.instances` is what makes the surrounding effect re-evaluate, and
    // `this` is Alpine's reactive proxy (and only Alpine's — hence `function`).
    base.isOpen = function (id) {
      return this.instances?.[id]?.open ?? false;
    };
    base.menuHidden = function (id) {
      return !(this.instances?.[id]?.open ?? false);
    };
    base.itemTabIndex = function (menuId, itemId) {
      return this.instances?.[menuId]?.activeItemId === itemId ? 0 : -1;
    };
    base.itemDisabled = function (menuId, itemId) {
      return this.instances?.[menuId]?.items?.find((i) => i.id === itemId)?.disabled ?? false;
    };
    const store: MenuStore = base;

    const sync = (): void => {
      // Mutate through the reactive proxy so Alpine triggers re-renders.
      syncRecordFromSnapshot(
        readAlpineStore<MenuStore>(alpine, storeKey, store).instances,
        controller.snapshotInstances()
      );
    };

    controller.on("change", sync);

    /**
     * Read a snapshot field through the **reactive store**, not the controller.
     *
     * A getter that reads a private controller field registers no dependency, so an
     * effect over it never re-runs — the same reason the store projection exists at
     * all (see the comment above `sync()`). Every value a directive writes to the DOM
     * therefore has to come from here.
     */
    function instanceOf(id: string): MenuStore["instances"][string] | undefined {
      return readAlpineStore<MenuStore>(alpine, storeKey, store).instances?.[id];
    }

    guardStore(alpine, storeKey, store, packageName);
    if (magicKey) {
      guardMagic(alpine, magicKey, () => readAlpineStore<MenuStore>(alpine, storeKey), packageName);
    }

    // x-menu, x-menu.trigger, x-menu.item: the element-bound halves of a menu.
    //
    // `bindMenu` and `bindTrigger` both store an element that only two readers
    // consult — `handleOutsideClick` and the focus restore in `close()`. Neither
    // has a release path: a hand-written binding left the container reference
    // pointing at a detached node, and `close()` kept calling `focus()` on it.
    // A store registration has no Alpine-invoked teardown in Alpine 3.17, so
    // this directive's own `cleanup()` is the only mechanism the runtime really
    // invokes — Alpine queues it in `el._x_cleanups` and `cleanupElement` drains
    // it when the element leaves the tree.
    //
    // All three forms are **modifiers of one directive**, not separate keys:
    // Alpine's directive regex (`^x-([^:^.]+)`) stops at the first dot, so
    // `x-menu.trigger` parses as type `menu` with modifiers `['trigger']`.
    // Registering a `menu-trigger` key would never match that markup.
    guardDirective(
      alpine,
      directiveKey,
      (el, { expression, modifiers }, utilities) => {
        const binding = createDirectiveBinding();
        utilities.cleanup(binding.release);

        // No modifier is the panel: `x-menu="'id'"`.
        const role = modifiers.includes("item")
          ? "item"
          : modifiers.includes("trigger")
            ? "trigger"
            : "panel";

        let bound: string | null = null;
        let stopProps: (() => void) | null = null;
        // The id this element generated for itself, remembered across effect
        // runs: an options bag with no `id` would otherwise generate a new one
        // every run, and neither `key === bound` nor the teardown would settle.
        let generated: string | null = null;

        const onDocumentClick = (event: MouseEvent): void => {
          if (bound === null) return;
          controller.handleOutsideClick(bound, event);
        };

        // Route clicks through the controller so `closeOnSelect` and the
        // `select` event still fire exactly as they did by hand.
        const onClick = (event: MouseEvent): void => {
          if (bound === null) return;
          if (role === "trigger") {
            controller.toggle(bound);
            return;
          }
          if (role === "item") {
            const separator = bound.indexOf(":");
            if (separator < 0) return;
            controller.selectItem(bound.slice(0, separator), bound.slice(separator + 1));
            return;
          }
          // A click on the panel is inside the menu, so it is not an
          // outside-click; the document listener already filters that by
          // `container.contains(target)`, and stopping here keeps a panel
          // click from also reaching whatever the host bound below it.
          event.stopPropagation();
        };

        const release = (): void => {
          stopProps?.();
          stopProps = null;
          if (bound !== null && role === "panel") {
            document.removeEventListener("click", onDocumentClick, true);
          }
          bound = null;
        };

        createValueReader<MenuOptions | string>(
          expression,
          { evaluateLater: utilities.evaluateLater, effect: utilities.effect },
          (next: MenuOptions | string) => {
            if (next === undefined || next === null || next === "") {
              release();
              return;
            }
            // An item needs `menuId:itemId` in one token, because a directive
            // cannot take two arguments and every item would otherwise repeat
            // the menu id. Only a trigger or a panel carries options — an item's
            // are a separate object, and its token is a compound.
            const bag = (typeof next === "object" ? next : {}) as MenuOptions & {
              id?: string;
            };
            const value = typeof next === "string" ? next : (bag.id ?? "");
            const [menuId, itemId] = value.split(":");
            // No id anywhere: generate one, so `x-menu="{ orientation:
            // 'vertical' }"` is a working menu rather than a silent no-op. The
            // trigger and the panel are separate elements, so they only pair up
            // if they name the SAME id — a generated id is for the single-element
            // case.
            const resolved = menuId || (role === "item" ? "" : (generated ??= generateId("menu")));
            const key =
              role === "item" ? (menuId && itemId ? `${menuId}:${itemId}` : null) : resolved;
            if (key === null) {
              release();
              return;
            }
            if (key === bound) return;
            release();
            bound = key;

            // Created here, not expected from the host: `x-menu="'nav'"` whose id
            // was never created used to bind a trigger to an instance that did
            // not exist, and every click on it toggled nothing.
            //
            // Only when missing. The trigger and the panel are separate
            // elements running this same directive, and the second one to run
            // would otherwise *replace* the instance the first one had already
            // bound its element to — losing `trigger`, which is what
            // `handleOutsideClick` checks to tell a trigger click from an
            // outside click. The symptom is a trigger that opens the menu and
            // never closes it.
            if (role !== "item") {
              if (!controller.hasInstance(resolved)) {
                const { id: _ignored, ...options } = bag;
                controller.create(resolved, options);
              }
              el.setAttribute("data-menu-id", resolved);
            }

            if (role === "trigger") {
              controller.bindTrigger(key, el as HTMLElement);
              // `aria-expanded` cannot come from `menuProps` either: an
              // object-form `x-bind` is applied once, so it froze at init.
              stopProps = bindProps(el, utilities, () => ({
                "aria-expanded": instanceOf(key)?.open ? "true" : "false",
                "aria-haspopup": "menu",
              }));
              return;
            }

            if (role === "item") {
              // `itemProps` generates an id, but the author's own id wins: an
              // element already carrying an id is usually referenced by
              // something else (a label, a test, a fragment link), and
              // overwriting it breaks all of them. Applied once here rather
              // than inside the effect, because a reactive `id` write would
              // fight the author for the attribute on every run.
              if (!el.id) el.id = controller.itemProps(menuId, itemId).id;
              stopProps = bindProps(el, utilities, () => {
                const state = instanceOf(menuId);
                return {
                  role: "menuitem",
                  // These two are precisely what `itemProps` omits: a roving
                  // tabindex frozen at init left the whole menu unreachable by
                  // keyboard, and `aria-disabled` never updated when an item was
                  // disabled after mount.
                  tabindex: state?.activeItemId === itemId ? 0 : -1,
                  "aria-disabled": state?.items?.find((i) => i.id === itemId)?.disabled
                    ? "true"
                    : null,
                };
              });
              return;
            }

            controller.bindMenu(key, el as HTMLElement);
            // Capture phase: a trigger that stops propagation on its own click
            // handler would otherwise silence the one click that must close.
            document.addEventListener("click", onDocumentClick, true);
          }
        );

        el.addEventListener("click", onClick);
        binding.add(() => {
          el.removeEventListener("click", onClick);
          // Unbind, not destroy: the trigger and the panel are separate
          // elements bound to the same instance, so the first one to leave the
          // tree would otherwise take the menu down under the other.
          if (bound !== null) {
            if (role === "trigger") controller.bindTrigger(bound, null);
            else if (role === "panel") controller.bindMenu(bound, null);
          }
          el.removeAttribute("data-menu-id");
          release();
        });
      },
      packageName
    );
  };
}

export default menuPlugin;
