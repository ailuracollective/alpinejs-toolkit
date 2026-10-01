// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import { html, mount, settled } from "@ailura/alpinejs-testing";
import { screen } from "@testing-library/dom";
import Alpine from "alpinejs";
import { describe, expect, test } from "vite-plus/test";

import { stateMachine } from "../src/plugin";
import { countWrites, facadeOf, setupMachineSuite } from "./helpers";

setupMachineSuite();

describe("factory coexistence", () => {
  test("two machines with different configs coexist independently", async () => {
    stateMachine()(Alpine);
    mount(
      html(`<div>
        <div x-data="{ m: $machine({ initial: 'idle', transitions: [{ name: 'FETCH', from: 'idle', to: 'loading' }] }) }">
          <span data-testid="a-state" x-text="m.state"></span>
          <button data-testid="a-fetch" @click="m.send('FETCH')">fetch</button>
        </div>
        <div x-data="{ m: $machine({ initial: 'locked', transitions: [{ name: 'UNLOCK', from: 'locked', to: 'unlocked' }] }) }">
          <span data-testid="b-state" x-text="m.state"></span>
        </div>
      </div>`)
    );
    await settled();
    expect(screen.getByTestId("a-state")).toHaveTextContent("idle");
    expect(screen.getByTestId("b-state")).toHaveTextContent("locked");

    screen.getByTestId("a-fetch").click();
    await settled();

    expect(screen.getByTestId("a-state")).toHaveTextContent("loading");
    expect(screen.getByTestId("b-state")).toHaveTextContent("locked");
  });

  test("cleanup isolation: removing one instance leaves the survivor working", async () => {
    stateMachine()(Alpine);
    const root = html(`<div>
      <div id="gone" x-data="{ m: $machine({ initial: 'idle', transitions: [{ name: 'FETCH', from: 'idle', to: 'loading' }] }) }" x-init="$el._facade = m">
        <span data-testid="a-state" x-text="m.state"></span>
      </div>
      <div id="kept" x-data="{ m: $machine({ initial: 'locked', transitions: [{ name: 'UNLOCK', from: 'locked', to: 'unlocked' }] }) }" x-init="$el._facade = m">
        <span data-testid="b-state" x-text="m.state"></span>
        <button data-testid="b-unlock" @click="m.send('UNLOCK')">unlock</button>
      </div>
    </div>`);
    mount(root);
    await settled();
    const removed = facadeOf<"idle" | "loading", "FETCH">(root, "#gone");
    expect(screen.getByTestId("a-state")).toHaveTextContent("idle");

    root.querySelector("#gone")?.remove();
    await settled();
    expect(screen.queryByTestId("a-state")).not.toBeInTheDocument();

    screen.getByTestId("b-unlock").click();
    await settled();
    expect(screen.getByTestId("b-state")).toHaveTextContent("unlocked");

    expect(removed.send("FETCH")).toBe(false);
  });

  test("write-once per instance: each committed transition writes exactly once", async () => {
    stateMachine()(Alpine);
    const root = html(`<div>
        <div id="a" x-data="{ m: $machine({ initial: 'idle', transitions: [{ name: 'FETCH', from: 'idle', to: 'loading' }] }) }" x-init="$el._facade = m">
          <span data-testid="a-state" x-text="m.state"></span>
        </div>
        <div id="b" x-data="{ m: $machine({ initial: 'locked', transitions: [{ name: 'UNLOCK', from: 'locked', to: 'unlocked' }] }) }" x-init="$el._facade = m">
          <span data-testid="b-state" x-text="m.state"></span>
        </div>
      </div>`);
    mount(root);
    await settled();

    const facadeA = facadeOf<"idle" | "loading", "FETCH">(root, "#a");
    const facadeB = facadeOf<"locked" | "unlocked", "UNLOCK">(root, "#b");
    const writesA = countWrites(facadeA);
    const writesB = countWrites(facadeB);

    expect(facadeA.send("FETCH")).toBe(true);
    expect(facadeB.send("UNLOCK")).toBe(true);
    await settled();

    expect(writesA.count()).toBe(1);
    expect(writesB.count()).toBe(1);
    expect(screen.getByTestId("a-state")).toHaveTextContent("loading");
    expect(screen.getByTestId("b-state")).toHaveTextContent("unlocked");
  });

  test("rejected send writes nothing per instance", async () => {
    stateMachine()(Alpine);
    const root = html(
      `<div id="a" x-data="{ m: $machine({ initial: 'loading', transitions: [{ name: 'DONE', from: 'loading', to: 'ready' }] }) }" x-init="$el._facade = m">
        <span data-testid="a-state" x-text="m.state"></span>
      </div>`
    );
    mount(root);
    await settled();
    expect(screen.getByTestId("a-state")).toHaveTextContent("loading");

    // RETRY is a known event with no edge from loading: typechecks, no-ops.
    const facadeA = facadeOf<"loading" | "ready", "DONE" | "RETRY">(root, "#a");
    const writes = countWrites(facadeA);
    expect(facadeA.send("RETRY")).toBe(false);
    await settled();

    expect(screen.getByTestId("a-state")).toHaveTextContent("loading");
    expect(writes.count()).toBe(0);
  });

  test("can()/cannot() bindings are reactive: disabled flips after a transition", async () => {
    stateMachine()(Alpine);
    mount(
      html(`<div x-data="{ m: $machine({
        initial: 'idle',
        transitions: [
          { name: 'FETCH', from: 'idle', to: 'loading' },
          { name: 'DONE', from: 'loading', to: 'ready' },
        ],
      }) }">
        <span data-testid="state" x-text="m.state"></span>
        <button data-testid="fetch" :disabled="!m.can('FETCH')" @click="m.send('FETCH')">fetch</button>
        <button data-testid="done" :disabled="!m.can('DONE')" @click="m.send('DONE')">done</button>
      </div>`)
    );
    await settled();
    // idle: FETCH enabled, DONE disabled.
    expect(screen.getByTestId("fetch")).not.toBeDisabled();
    expect(screen.getByTestId("done")).toBeDisabled();

    screen.getByTestId("fetch").click();
    await settled();
    // loading: FETCH disabled, DONE enabled — bindings must have re-evaluated.
    expect(screen.getByTestId("state")).toHaveTextContent("loading");
    expect(screen.getByTestId("fetch")).toBeDisabled();
    expect(screen.getByTestId("done")).not.toBeDisabled();

    screen.getByTestId("done").click();
    await settled();
    expect(screen.getByTestId("state")).toHaveTextContent("ready");
    expect(screen.getByTestId("fetch")).toBeDisabled();
    expect(screen.getByTestId("done")).toBeDisabled();
  });
});

describe("factory rename", () => {
  test("magicKey renames $machine to $fsm per evaluation", async () => {
    stateMachine({ magicKey: "fsm" })(Alpine);
    mount(
      html(`<div x-data="{ m: $fsm({ initial: 'idle', transitions: [{ name: 'FETCH', from: 'idle', to: 'loading' }] }) }">
        <span data-testid="fsm" x-text="m.state"></span>
        <button data-testid="fsm-fetch" @click="m.send('FETCH')">fetch</button>
      </div>`)
    );
    await settled();
    expect(screen.getByTestId("fsm")).toHaveTextContent("idle");

    screen.getByTestId("fsm-fetch").click();
    await settled();
    expect(screen.getByTestId("fsm")).toHaveTextContent("loading");
  });
});
