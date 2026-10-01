// @vitest-environment happy-dom
/**
 * Tests for the SSR-safe portal root factory.
 *
 * DOM tests run under happy-dom; the SSR contract (no `document`
 * → `null`) is covered by stubbing the global away in the final
 * describe block, so no separate node-env file is needed.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

import {
  createPortalRoot as createPortalRootFromBarrel,
  removePortalRoot as removePortalRootFromBarrel,
} from "../src/index";
import { createPortalRoot, removePortalRoot } from "../src/portal";

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("createPortalRoot", () => {
  test("creates a div#overlay-root appended to body by default", () => {
    const el = createPortalRoot();

    expect(el).toBeInstanceOf(HTMLElement);
    expect(el?.tagName).toBe("DIV");
    expect(el?.id).toBe("overlay-root");
    expect(document.body.contains(el)).toBe(true);
  });

  test("is idempotent — repeat calls return the same element", () => {
    const first = createPortalRoot();
    const second = createPortalRoot();

    expect(second).toBe(first);
    expect(document.querySelectorAll("#overlay-root")).toHaveLength(1);
  });

  test("honours custom id, className, and tag", () => {
    const el = createPortalRoot({ id: "my-portal", className: "fixed inset-0", as: "section" });

    expect(el?.tagName).toBe("SECTION");
    expect(el?.id).toBe("my-portal");
    expect(el?.className).toBe("fixed inset-0");
    expect(document.getElementById("my-portal")).toBe(el);
  });

  test("returns the existing element without re-styling it", () => {
    const seeded = document.createElement("div");
    seeded.id = "existing-root";
    seeded.className = "keep-me";
    document.body.appendChild(seeded);

    const el = createPortalRoot({ id: "existing-root", className: "do-not-apply" });

    expect(el).toBe(seeded);
    expect(el?.className).toBe("keep-me");
  });

  test("custom ids are idempotent too", () => {
    const first = createPortalRoot({ id: "custom" });
    const second = createPortalRoot({ id: "custom" });

    expect(second).toBe(first);
  });

  test("the barrel re-exports the same factory", () => {
    expect(createPortalRootFromBarrel).toBe(createPortalRoot);
  });
});

describe("createPortalRoot (SSR)", () => {
  test("returns null when document is unavailable", () => {
    vi.stubGlobal("document", undefined);

    expect(createPortalRoot()).toBeNull();
    expect(createPortalRoot({ id: "custom" })).toBeNull();
  });
});

describe("removePortalRoot", () => {
  // Guards, not a RED-first case: the helper already exists, so these pin its
  // contract rather than driving a new implementation.
  test("detaches the node the caller hands it and reports it", () => {
    const el = createPortalRoot({ id: "overlay-root" });
    expect(document.body.contains(el)).toBe(true);

    expect(removePortalRoot(el)).toBe(true);

    expect(document.getElementById("overlay-root")).toBeNull();
    expect(document.body.contains(el)).toBe(false);
  });

  test("is a no-op for null and undefined rather than a throw", () => {
    expect(() => removePortalRoot(null)).not.toThrow();
    expect(() => removePortalRoot(undefined)).not.toThrow();

    expect(removePortalRoot(null)).toBe(false);
    expect(removePortalRoot(undefined)).toBe(false);
  });

  test("is idempotent — a second call on the same node is a no-op", () => {
    const el = createPortalRoot({ id: "overlay-root" });
    expect(removePortalRoot(el)).toBe(true);

    // Already detached: nothing left to remove, and still nothing thrown.
    expect(() => removePortalRoot(el)).not.toThrow();
    expect(removePortalRoot(el)).toBe(false);
  });

  test("detaches only the node it was given, never its neighbours", () => {
    const target = createPortalRoot({ id: "overlay-root" });
    const bystander = createPortalRoot({ id: "other-root" });

    expect(removePortalRoot(target)).toBe(true);

    expect(document.getElementById("overlay-root")).toBeNull();
    expect(document.getElementById("other-root")).toBe(bystander);
    expect(document.body.contains(bystander)).toBe(true);
  });

  test("returns false for a node that was never attached", () => {
    const orphan = document.createElement("div");
    orphan.id = "never-appended";

    expect(() => removePortalRoot(orphan)).not.toThrow();
    expect(removePortalRoot(orphan)).toBe(false);
  });

  test("the barrel re-exports the same helper", () => {
    expect(removePortalRootFromBarrel).toBe(removePortalRoot);
  });
});

describe("removePortalRoot (SSR)", () => {
  test("returns false when document is unavailable", () => {
    const el = createPortalRoot({ id: "overlay-root" });
    expect(document.body.contains(el)).toBe(true);
    vi.stubGlobal("document", undefined);

    expect(removePortalRoot(el)).toBe(false);
    expect(removePortalRoot(null)).toBe(false);
  });
});
