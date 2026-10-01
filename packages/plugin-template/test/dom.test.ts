// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import { html, mount, reset, resume, settled, start } from "@ailura/alpinejs-testing";
import { screen } from "@testing-library/dom";
import Alpine from "alpinejs";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vite-plus/test";

import pluginTemplate from "../src/index";

beforeAll(() => {
  start(pluginTemplate);
});

beforeEach(() => {
  resume();
  Alpine.store("pluginTemplate").ready = true;
});

afterEach(() => {
  reset();
});

describe("plugin-template (Alpine integration)", () => {
  test("x-upper uppercases the evaluated expression", async () => {
    mount(html("<div x-data><span x-upper=\"'hello'\"></span></div>"));
    await settled();

    expect(screen.getByText("HELLO")).toBeInTheDocument();
  });

  test("x-upper without an expression uppercases the element text", async () => {
    mount(html("<div x-data><span x-upper>hello</span></div>"));
    await settled();

    expect(screen.getByText("HELLO")).toBeInTheDocument();
  });

  test("$greet magic returns a greeting inside an expression", async () => {
    mount(html("<div x-data><span x-text=\"$greet('Ada')\"></span></div>"));
    await settled();

    expect(screen.getByText("Hello, Ada!")).toBeInTheDocument();
  });

  test("pluginTemplate store is readable and writable", async () => {
    mount(html('<div x-data><span x-text="String($store.pluginTemplate.ready)"></span></div>'));
    await settled();

    expect(Alpine.store("pluginTemplate").ready).toBe(true);
    expect(screen.getByText("true")).toBeInTheDocument();

    Alpine.store("pluginTemplate").ready = false;
    await settled();

    expect(screen.getByText("false")).toBeInTheDocument();
  });
});
