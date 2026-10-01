// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import { settled } from "@ailura/alpinejs-testing";
import { screen } from "@testing-library/dom";
import type { Alpine as AlpineInstance } from "alpinejs";
import { describe, expect, test, vi } from "vite-plus/test";

import { defineMachine } from "../src/types";
import { facadeOf, machineHtml, mountMachines, setupMachineSuite } from "./helpers";

const configA = defineMachine({
  initial: "idle",
  transitions: [
    { name: "FETCH", from: "idle", to: "loading" },
    { name: "DONE", from: "loading", to: "ready" },
  ],
});

const configB = defineMachine({
  initial: "locked",
  transitions: [{ name: "UNLOCK", from: "locked", to: "unlocked" }],
});

type AStates = "idle" | "loading" | "ready";
type AEvents = "FETCH" | "DONE";
type BStates = "locked" | "unlocked";
type BEvents = "UNLOCK";

setupMachineSuite();

describe("factory isolation", () => {
  test("two evaluations return distinct facades with distinct ids", async () => {
    const root = await mountMachines(`${machineHtml("a", configA)}${machineHtml("b", configB)}`);
    const a = facadeOf<AStates, AEvents>(root, "#a");
    const b = facadeOf<BStates, BEvents>(root, "#b");

    expect(a).not.toBe(b);
    expect(a.id).not.toBe(b.id);
    expect(a.state).toBe("idle");
    expect(b.state).toBe("locked");
    expect(screen.getByTestId("a-state")).toHaveTextContent("idle");
    expect(screen.getByTestId("b-state")).toHaveTextContent("locked");
  });

  test("independent send and reset: a cycles while b is unaffected", async () => {
    const root = await mountMachines(`${machineHtml("a", configA)}${machineHtml("b", configB)}`);
    const a = facadeOf<AStates, AEvents>(root, "#a");
    const b = facadeOf<BStates, BEvents>(root, "#b");

    expect(a.send("FETCH")).toBe(true);
    await settled();
    expect(screen.getByTestId("a-state")).toHaveTextContent("loading");
    expect(screen.getByTestId("b-state")).toHaveTextContent("locked");

    a.reset();
    await settled();
    expect(screen.getByTestId("a-state")).toHaveTextContent("idle");
    expect(b.send("UNLOCK")).toBe(true);
    await settled();
    expect(screen.getByTestId("b-state")).toHaveTextContent("unlocked");
    expect(screen.getByTestId("a-state")).toHaveTextContent("idle");
  });

  test("no shared facade state: a write to one never mutates the other", async () => {
    const root = await mountMachines(`${machineHtml("a", configA)}${machineHtml("b", configA)}`);
    const a = facadeOf<AStates, AEvents>(root, "#a");
    const b = facadeOf<AStates, AEvents>(root, "#b");

    expect(a).not.toBe(b);
    expect(a.send("FETCH")).toBe(true);
    await settled();

    expect(a.state).toBe("loading");
    expect(a.value).toBe("loading");
    expect(b.state).toBe("idle");
    expect(b.value).toBe("idle");
    expect(screen.getByTestId("a-state")).toHaveTextContent("loading");
    expect(screen.getByTestId("b-state")).toHaveTextContent("idle");
  });

  test("each evaluation wires its own cleanup(dispose)", async () => {
    const root = await mountMachines(`${machineHtml("a", configA)}${machineHtml("b", configB)}`);
    const a = facadeOf<AStates, AEvents>(root, "#a");
    const b = facadeOf<BStates, BEvents>(root, "#b");

    root.querySelector("#a")?.remove();
    await settled();
    expect(screen.queryByTestId("a-state")).not.toBeInTheDocument();
    expect(a.send("FETCH")).toBe(false);
    expect(b.send("UNLOCK")).toBe(true);
    await settled();
    expect(screen.getByTestId("b-state")).toHaveTextContent("unlocked");

    root.querySelector("#b")?.remove();
    await settled();
    b.reset();
    expect(b.state).toBe("unlocked");
  });

  test("per-instance dispose is idempotent and isolated", async () => {
    const root = await mountMachines(`${machineHtml("a", configA)}${machineHtml("b", configB)}`);
    const a = facadeOf<AStates, AEvents>(root, "#a");
    const b = facadeOf<BStates, BEvents>(root, "#b");

    expect(() => {
      b.dispose();
      b.dispose();
    }).not.toThrow();
    expect(b.send("UNLOCK")).toBe(false);
    expect(b.state).toBe("locked");

    expect(a.send("FETCH")).toBe(true);
    await settled();
    expect(screen.getByTestId("a-state")).toHaveTextContent("loading");
  });

  test("per-instance init ordering: setSilently wins for that instance only", async () => {
    const root = await mountMachines(
      `${machineHtml("a", configA, "; m.setSilently('ready')")}${machineHtml("b", configB)}`
    );
    const a = facadeOf<AStates, AEvents>(root, "#a");
    const b = facadeOf<BStates, BEvents>(root, "#b");

    expect(a.state).toBe("ready");
    expect(screen.getByTestId("a-state")).toHaveTextContent("ready");
    expect(b.state).toBe("locked");
    expect(screen.getByTestId("b-state")).toHaveTextContent("locked");

    expect(b.send("UNLOCK")).toBe(true);
    await settled();
    expect(screen.getByTestId("b-state")).toHaveTextContent("unlocked");
    expect(screen.getByTestId("a-state")).toHaveTextContent("ready");
  });
});

describe("factory SSR safety", () => {
  test("import + factory are SSR-safe with an Alpine stub (no DOM globals)", async () => {
    // Inline vitest stub — the single contained cast in the suite: a minimal
    // test double (identity `reactive`, recording `magic`), not a full Alpine.
    const reactive = vi.fn((target: object): object => target);
    const magic = vi.fn();
    const stub = { reactive, magic } as unknown as AlpineInstance;

    const mod = await import("../src/index");
    expect(() => mod.stateMachine()(stub)).not.toThrow();
    expect(magic).toHaveBeenCalledWith("machine", expect.any(Function));

    expect(() => mod.stateMachine({ magicKey: "fsm" })(stub)).not.toThrow();
    expect(magic).toHaveBeenCalledWith("fsm", expect.any(Function));
  });
});
