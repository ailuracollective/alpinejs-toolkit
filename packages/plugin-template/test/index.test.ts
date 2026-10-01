import { describe, expect, test } from "vite-plus/test";

import { pluginName, toUpper } from "../src/index";

describe("plugin-template", () => {
  test("exposes a plugin name", () => {
    expect(pluginName).toBe("plugin-template");
  });

  test("toUpper uppercases text", () => {
    expect(toUpper("hello")).toBe("HELLO");
    expect(toUpper("Alpine.js")).toBe("ALPINE.JS");
    expect(toUpper("")).toBe("");
  });
});
