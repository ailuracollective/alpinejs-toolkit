// @vitest-environment happy-dom
/**
 * Menu accessibility: `aria-hidden` and focus.
 *
 * A browser warning said: "Blocked aria-hidden on an element because its
 * descendant retained focus." Two independent causes, both confirmed here.
 *
 * 1. Focus was never returned on close. `close()` set `open = false`, the menu
 *    went to `display: none`, and the focused item stayed the active element of
 *    a hidden subtree — so the browser blocked the `aria-hidden` and warned, and
 *    the next Tab resumed from a node the user cannot see.
 *
 * 2. `aria-hidden` never actually toggled. Alpine applies an OBJECT-form
 *    `x-bind` exactly once, so `x-bind="$store.menu.menuProps(id)"` froze
 *    every value at init: the menu reported `aria-hidden="true"` even while
 *    open, and `itemProps` froze `tabindex="-1"` on every item, leaving the
 *    menu unreachable by keyboard. The roving tabindex and `aria-hidden` moved
 *    out of the objects into per-attribute accessors, which do re-evaluate.
 */
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import { MenuController } from "../src/controller";
import { menuPlugin } from "../src/plugin";

interface MenuStoreLike {
  register(id: string, options?: unknown): void;
  registerItem(menuId: string, itemId: string, options?: { disabled?: boolean }): void;
  bindMenu(menuId: string, el: HTMLElement | null): void;
  bindTrigger(menuId: string, el: HTMLElement | null): void;
  open(id: string): void;
  close(id: string): void;
  toggle(id: string): void;
  isOpen(id: string): boolean;
  selectItem(menuId: string, itemId: string): void;
  setActiveItem(menuId: string, itemId: string | null): void;
  handleKeydown(menuId: string, e: KeyboardEvent): void;
  menuProps(id: string): Record<string, string | undefined>;
  menuHidden(id: string): boolean;
  itemProps(menuId: string, itemId: string): Record<string, string>;
  itemTabIndex(menuId: string, itemId: string): number;
  itemDisabled(menuId: string, itemId: string): boolean;
}

const store = () => Alpine.store("menu") as unknown as MenuStoreLike;

/** The demo's structure: a wrapper div bound as the trigger, holding the button. */
async function demo() {
  const el = html(`
    <div x-data="{
      init() {
        $store.menu.create('m', {})
        $store.menu.createItem('m', 'billing')
        $store.menu.createItem('m', 'settings', { disabled: true })
        $store.menu.createItem('m', 'profile')
      }
    }">
      <div x-ref="trigger" x-init="$store.menu.bindTrigger('m', $el)">
        <button
          id="trigger"
          type="button"
          aria-haspopup="menu"
          @click="$store.menu.toggle('m')"
        >
          Account
        </button>
      </div>
      <ul
        id="m"
        x-show="$store.menu.isOpen('m')"
        x-bind="$store.menu.menuProps('m')"
        x-bind:aria-hidden="$store.menu.menuHidden('m')"
        x-init="$store.menu.bindMenu('m', $el)"
      >
        <template x-for="id in ['billing', 'settings', 'profile']" :key="id">
          <button
            type="button"
            :id="'m-item-' + id"
            x-bind="$store.menu.itemProps('m', id)"
            x-bind:tabindex="$store.menu.itemTabIndex('m', id)"
            x-bind:aria-disabled="$store.menu.itemDisabled('m', id)"
            @click="$store.menu.selectItem('m', id)"
            x-text="id"
          ></button>
        </template>
      </ul>
    </div>
  `);
  mount(el as HTMLElement);
  await settled();
  return el as HTMLElement;
}

function byId(el: Element, id: string): HTMLElement {
  const found = el.querySelector<HTMLElement>(`#${id}`);
  if (!found) throw new Error(`no element #${id}`);
  return found;
}

beforeAll(() => {
  start(menuPlugin());
});

beforeEach(() => {
  resume();
});

afterEach(() => {
  reset();
});

describe("aria-hidden tracks the open state", () => {
  test("it is removed while open and restored while closed", async () => {
    const el = await demo();
    const menu = byId(el, "m");

    expect(menu.getAttribute("aria-hidden")).toBe("true");

    byId(el, "trigger").click();
    await settled();
    // The bug: this stayed "true" because the object-form x-bind froze it.
    expect(menu.getAttribute("aria-hidden")).toBeNull();

    store().close("m");
    await settled();
    expect(menu.getAttribute("aria-hidden")).toBe("true");
  });

  test("menuHidden() is the accessor the binding uses", () => {
    const controller = new MenuController();
    controller.create("m", {});
    expect(controller.menuHidden("m")).toBe(true);
    controller.open("m");
    expect(controller.menuHidden("m")).toBe(false);
    expect(controller.menuProps("m")).not.toHaveProperty("aria-hidden");
    controller.destroy();
  });
});

describe("roving tabindex", () => {
  test("exactly one item is tabbable and it moves", async () => {
    const el = await demo();
    const billing = byId(el, "m-item-billing");
    const settings = byId(el, "m-item-settings");
    const profile = byId(el, "m-item-profile");

    byId(el, "trigger").click();
    await settled();
    expect(billing.getAttribute("tabindex")).toBe("0");
    expect(settings.getAttribute("tabindex")).toBe("-1");
    expect(profile.getAttribute("tabindex")).toBe("-1");

    store().setActiveItem("m", "profile");
    await settled();
    expect(billing.getAttribute("tabindex")).toBe("-1");
    expect(profile.getAttribute("tabindex")).toBe("0");
  });

  test("a disabled item never becomes the roving target", async () => {
    const el = await demo();
    byId(el, "trigger").click();
    await settled();

    store().setActiveItem("m", "settings");
    await settled();
    // `setActiveItem` ignores a disabled item, so the active one is unchanged.
    expect(byId(el, "m-item-billing").getAttribute("tabindex")).toBe("0");
    expect(byId(el, "m-item-settings").getAttribute("tabindex")).toBe("-1");
  });

  test("aria-disabled reflects the item state", async () => {
    const el = await demo();
    expect(byId(el, "m-item-billing").getAttribute("aria-disabled")).toBeNull();
    expect(byId(el, "m-item-settings").getAttribute("aria-disabled")).toBe("true");
  });

  test("itemProps carries only the static attributes", () => {
    const controller = new MenuController();
    controller.create("m", {});
    controller.createItem("m", "a");
    expect(Object.keys(controller.itemProps("m", "a")).sort()).toEqual(["id", "role"]);
    controller.destroy();
  });
});

describe("focus returns to the trigger on close", () => {
  test("after selecting an item", async () => {
    const el = await demo();
    byId(el, "trigger").click();
    await settled();

    const item = byId(el, "m-item-billing");
    item.focus();
    expect(document.activeElement).toBe(item);

    // `HTMLElement.click()` in happy-dom resets `activeElement` to `body` before
    // dispatching, which a real browser does not do for a focused button. That
    // would make this test pass or fail for a reason that cannot happen in a
    // browser, so the event is dispatched directly.
    item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settled();

    expect(store().isOpen("m")).toBe(false);
    // The trigger is a plain <div> wrapper, so this only works because the
    // focusable button inside it is found.
    expect(document.activeElement).toBe(byId(el, "trigger"));
    expect(byId(el, "m").contains(document.activeElement)).toBe(false);
  });

  test("after Escape", async () => {
    const el = await demo();
    byId(el, "trigger").click();
    await settled();

    const item = byId(el, "m-item-billing");
    item.focus();
    store().handleKeydown("m", new KeyboardEvent("keydown", { key: "Escape" }));
    await settled();

    expect(store().isOpen("m")).toBe(false);
    expect(document.activeElement).toBe(byId(el, "trigger"));
  });

  test("a close that never held focus leaves focus alone", async () => {
    const el = await demo();
    byId(el, "trigger").click();
    await settled();

    const other = document.createElement("button");
    other.id = "elsewhere";
    document.body.append(other);
    other.focus();
    expect(document.activeElement).toBe(other);

    store().close("m");
    await settled();
    // Stealing focus here would be a regression.
    expect(document.activeElement).toBe(other);
    other.remove();
  });

  test("focusableWithin prefers the focusable descendant", () => {
    const controller = new MenuController();
    const wrapper = document.createElement("div");
    const button = document.createElement("button");
    wrapper.append(button);
    const container = document.createElement("ul");
    const item = document.createElement("button");
    container.append(item);
    document.body.append(wrapper, container);

    controller.create("m", {});
    controller.bindTrigger("m", wrapper as HTMLElement);
    controller.bindMenu("m", container);
    controller.open("m");

    item.focus();
    expect(document.activeElement).toBe(item);
    controller.close("m");
    // The trigger is a plain <div>, so only the button inside it can take focus.
    expect(document.activeElement).toBe(button);

    wrapper.remove();
    container.remove();
    controller.destroy();
  });
});
