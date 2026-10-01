import { guardStore } from "@ailura/alpinejs-core/guards";
import { resolveStoreKey } from "@ailura/alpinejs-core/registration";
import type { Alpine } from "alpinejs";

import { CommandController } from "./controller";
import type { CommandPluginCallback, CommandPluginOptions, CommandStore } from "./types";
import { DEFAULT_COMMAND_STORE_KEY } from "./types";

const packageName = "@ailura/alpinejs-command";

export function commandPlugin(options: CommandPluginOptions = {}): CommandPluginCallback {
  const storeKey = resolveStoreKey(options, DEFAULT_COMMAND_STORE_KEY);
  return function registerCommand(alpine: Alpine): void {
    const controller = new CommandController(options.id, options);

    // Alpine's `store()` wraps the value in a reactive proxy, but a *getter* that
    // reads a private field on a plain controller registers no dependency: the
    // template tracks a key that nothing ever writes. This store used to be
    // exactly that — a bag of getters plus a `const sync = () => {}` and a
    // comment claiming "Alpine reactivity will pick up getter reads", which it
    // does not. The consequence was a dead demo: `open()` flipped the
    // controller's own state while the view kept rendering the first read, so
    // the palette never opened, the search never filtered, and the active row
    // never moved.
    //
    // So the state lives in a reactive `view` that `sync()` writes, and only the
    // genuinely write-through fields stay accessors (see `search` below).
    const maybeReactive = (alpine as unknown as { reactive?: (v: unknown) => unknown }).reactive;
    const view = (maybeReactive ? maybeReactive({}) : {}) as Record<string, unknown>;

    // `x-model="$store.command.search"` assigns to these, so they must reach the
    // controller. Both setters emit `change`, which drives the `sync` below and
    // therefore refreshes every derived field. `sync` must NOT write them back:
    // assigning through these accessors would re-enter the controller.
    Object.defineProperties(view, {
      search: {
        configurable: true,
        enumerable: true,
        get: () => controller.search,
        set: (value: string) => {
          controller.search = value;
        },
      },
      activeIndex: {
        configurable: true,
        enumerable: true,
        get: () => controller.activeIndex,
        set: (value: number) => {
          controller.activeIndex = value;
        },
      },
    });

    // Closures so `this` never resolves to the reactive proxy; reading a class
    // `#private` member through that proxy throws.
    view["open"] = (): void => controller.open();
    view["close"] = (): void => controller.close();
    view["toggle"] = (): void => controller.toggle();
    view["register"] = (item: import("./types").CommandItem): (() => void) =>
      controller.register(item);
    view["unregister"] = (id: string): void => controller.unregister(id);
    view["run"] = (id: string): void => void controller.run(id);
    view["cancelRun"] = (): void => controller.cancelRun();
    view["handleKeydown"] = (event: KeyboardEvent): void => controller.handleKeydown(event);
    view["pushPage"] = (page: import("./types").CommandPage): Promise<void> =>
      controller.pushPage(page);
    view["popPage"] = (): void => controller.popPage();
    view["goBack"] = (): void => controller.goBack();
    view["itemState"] = (id: string) => controller.itemState(id);
    view["inputProps"] = () => controller.inputProps();
    view["listboxProps"] = () => controller.listboxProps();
    view["optionProps"] = (id: string) => controller.optionProps(id);
    view["destroy"] = (): void => controller.destroy();

    // `change` is emitted by every mutation — search, activeIndex, register,
    // open/close, run, page navigation — so one subscription covers them all.
    const sync = (): void => {
      view["visible"] = controller.visible;
      view["isOpen"] = controller.isOpen;
      view["executionState"] = controller.executionState;
      view["runningId"] = controller.runningId;
      view["currentPageId"] = controller.currentPageId;
      view["pageStack"] = controller.pageStack;
      view["pages"] = controller.pages;
      view["items"] = controller.items;
      view["loadingIds"] = controller.loadingIds;
      view["pinnedIds"] = controller.pinnedIds;
      view["recentIds"] = controller.recentIds;
      view["filteredItems"] = controller.filteredItems;
      view["visibleItems"] = controller.visibleItems;
      view["groupedItems"] = controller.groupedItems;
    };
    controller.on("change", sync);
    controller.on("open", sync);
    controller.on("close", sync);

    // Never hand out an empty store: a host may read it before any event.
    sync();

    guardStore(alpine, storeKey, view as unknown as CommandStore, packageName);
  };
}

export default commandPlugin;
