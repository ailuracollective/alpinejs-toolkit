// @vitest-environment happy-dom
/**
 * `x-menu`, `x-menu.trigger`, `x-menu.item` — the element-bound halves of a menu.
 *
 * `bindMenu` and `bindTrigger` store an element that only two readers consult:
 * `handleOutsideClick` and the focus restore in `close()`. Neither has a release
 * path, so a hand-written binding left the container pointing at a detached node
 * and `close()` kept calling `focus()` on it. A store registration has no
 * Alpine-invoked teardown in Alpine 3.17, so the directive's `cleanup()` is the
 * only mechanism the runtime really invokes.
 *
 * The item form is the other half: `itemProps` deliberately omits `tabindex`
 * and `aria-disabled` because an object-form `x-bind` is applied exactly once,
 * so a roving tabindex in that record never moved and the menu was unreachable
 * by keyboard at all. Writing them imperatively inside an effect is what makes
 * them live.
 *
 * All three forms are modifiers of ONE directive: Alpine's directive regex
 * (`^x-([^:^.]+)`) stops at the first dot, so `x-menu.trigger` parses as type
 * `menu` with modifiers `['trigger']`.
 */
import { clearAllSingletons } from "@ailura/alpinejs-core/singletons";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { menuPlugin } from "../src/plugin";
import type { MenuStore } from "../src/types";

function store(): MenuStore {
  return (Alpine as unknown as { store(name: string): MenuStore }).store("menu");
}

/** Flush past Alpine's mutation observer, as the carousel tests do. */
async function flush(): Promise<void> {
  await settled();
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  await settled();
}

/** The menu markup the directive is meant to replace, verbatim in shape. */
function menuMarkup(id: string): string {
  return `
    <div id="root">
      <button id="trigger" x-menu.trigger="'${id}'">Actions</button>
      <div id="panel" x-menu="'${id}'">
        <button id="rename" x-menu.item="'${id}:rename'">Rename</button>
        <button id="delete" x-menu.item="'${id}:delete'">Delete</button>
      </div>
    </div>`;
}

function click(el: Element | null): void {
  el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

beforeAll(() => {
  start(() => {});
});

beforeEach(() => {
  clearAllSingletons();
  menuPlugin()(Alpine as unknown as import("alpinejs").Alpine);
  resume();
});

afterEach(() => {
  reset();
});

describe("x-menu directive", () => {
  test("the trigger toggles the menu and reports its state", async () => {
    const root = html(`<div x-data>${menuMarkup("row-actions")}</div>`);
    mount(root);
    await flush();

    const trigger = root.querySelector("#trigger") as HTMLElement;
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    click(trigger);
    await flush();
    expect(store().isOpen("row-actions")).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    click(trigger);
    await flush();
    expect(store().isOpen("row-actions")).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  test("items get a live roving tabindex, which object-form x-bind cannot do", async () => {
    const root = html(`<div x-data>${menuMarkup("row-actions")}</div>`);
    mount(root);
    await flush();
    // `setActiveItem` only promotes a registered item, so the host registers
    // the ones the markup refers to.
    store().createItem("row-actions", "rename");
    store().createItem("row-actions", "delete");
    store().open("row-actions");
    await flush();

    const rename = root.querySelector("#rename") as HTMLElement;
    const del = root.querySelector("#delete") as HTMLElement;

    expect(rename.getAttribute("role")).toBe("menuitem");
    // `registerItem` promotes the first registered item, so at most one is
    // reachable — which is what a roving tabindex is for.
    expect([rename.getAttribute("tabindex"), del.getAttribute("tabindex")].sort()).toEqual([
      "-1",
      "0",
    ]);

    store().setActiveItem("row-actions", "delete");
    await flush();
    // The focus moved: live, where an object-form `x-bind` would have frozen
    // both attributes at their init values.
    expect(rename.getAttribute("tabindex")).toBe("-1");
    expect(del.getAttribute("tabindex")).toBe("0");
  });

  test("clicking an item selects it and closes the menu", async () => {
    const root = html(`<div x-data>${menuMarkup("row-actions")}</div>`);
    mount(root);
    await flush();
    store().createItem("row-actions", "rename");
    store().createItem("row-actions", "delete");
    store().open("row-actions");
    await flush();

    click(root.querySelector("#rename"));
    await flush();

    expect(store().instances["row-actions"]?.activeItemId).toBe("rename");
    // `closeOnSelect` defaults to closing, and the directive routes through the
    // controller so that default still applies.
    expect(store().isOpen("row-actions")).toBe(false);
  });

  test("aria-disabled tracks the item's disabled state", async () => {
    // The directive does not register items — the host still owns
    // `registerItem`, because the item list usually comes from a data source.
    // Registering a disabled item has to be visible on the element.
    const root = html(`<div x-data>${menuMarkup("row-actions")}</div>`);
    mount(root);
    await flush();
    store().createItem("row-actions", "delete", { disabled: true });
    await flush();

    expect((root.querySelector("#delete") as HTMLElement).getAttribute("aria-disabled")).toBe(
      "true"
    );
  });

  test("a click outside closes the menu", async () => {
    const root = html(`<div x-data>${menuMarkup("row-actions")}</div>`);
    mount(root);
    await flush();
    store().open("row-actions");
    await flush();

    click(root.querySelector("#root"));
    await flush();
    expect(store().isOpen("row-actions")).toBe(false);
  });

  test("a click inside the panel is not an outside-click", async () => {
    const root = html(`<div x-data>${menuMarkup("row-actions")}</div>`);
    mount(root);
    await flush();
    store().open("row-actions");
    await flush();

    click(root.querySelector("#panel"));
    await flush();
    expect(store().isOpen("row-actions")).toBe(true);
  });

  test("a click on the trigger is not an outside-click either", async () => {
    const root = html(`<div x-data>${menuMarkup("row-actions")}</div>`);
    mount(root);
    await flush();
    click(root.querySelector("#trigger"));
    await flush();

    // The outside-click handler and the toggle both ran; the net result is the
    // documented one (open), not a close.
    expect(store().isOpen("row-actions")).toBe(true);
  });

  test("releases the bindings when Alpine removes the elements", async () => {
    const root = html(`<div x-data>${menuMarkup("row-actions")}</div>`);
    mount(root);
    await flush();
    store().createItem("row-actions", "rename");
    store().open("row-actions");
    await flush();

    root.querySelector("#panel")?.remove();
    root.querySelector("#trigger")?.remove();
    await flush();

    // The panel's document listener went with it. What proves the release is
    // that a click no longer closes the menu: the delegated listener was the
    // only thing calling `handleOutsideClick`, and the host never wired one.
    click(root.querySelector("#root"));
    await flush();
    expect(store().isOpen("row-actions")).toBe(true);
  });

  test("the hand-written bindTrigger and bindMenu are unchanged", async () => {
    // The IIFE is load-bearing here too: `x-init`'s return value is invoked when
    // it is a function, and `bindMenu` returns the controller's `void` — so a
    // bare multi-statement `x-init` only keeps its first statement.
    const root = html(
      `<div x-data>
         <button id="trigger" x-init="(() => { $store.menu.bindTrigger('manual', $el); })()"></button>
         <div id="panel" x-init="(() => { $store.menu.bindMenu('manual', $el); })()"></div>
       </div>`
    );
    mount(root);
    await flush();
    store().open("manual");
    await flush();
    expect(store().isOpen("manual")).toBe(true);

    // The bindings are live: `handleOutsideClick` treats both the trigger and
    // the container as inside, so a click on either keeps the menu open.
    click(root.querySelector("#trigger"));
    await flush();
    expect(store().isOpen("manual")).toBe(true);

    click(root.querySelector("#panel"));
    await flush();
    expect(store().isOpen("manual")).toBe(true);
  });

  test("an empty expression binds nothing and throws nothing", async () => {
    const root = html(`<div x-data><div id="panel" x-menu></div></div>`);
    mount(root);
    await flush();

    expect(() => click(document.body)).not.toThrow();
  });
});
