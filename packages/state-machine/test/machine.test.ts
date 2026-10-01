import { describe, expect, test } from "vite-plus/test";

import { MachineController } from "../src/machine";
import { defineMachine } from "../src/types";
import type { ChangeDetail, MachineConfig } from "../src/types";

const baseConfig = defineMachine({
  initial: "idle",
  transitions: [
    { name: "FETCH", from: "idle", to: "loading" },
    { name: "DONE", from: "loading", to: "ready" },
    { name: "FAIL", from: "loading", to: "error" },
    { name: "RETRY", from: "error", to: "loading" },
  ],
});

type BaseTransition = (typeof baseConfig)["transitions"][number];
type State = BaseTransition["from"] | BaseTransition["to"];

function createMachine<S extends string, E extends string>(
  config: MachineConfig<S, E>
): MachineController<S, E> {
  return new MachineController(config);
}

/** Drain the microtask queue (plus a macrotask) so queued init emits flush. */
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("MachineController types (task 1.2)", () => {
  test("accepts a typed MachineConfig and starts at initial", () => {
    const machine = createMachine(baseConfig);

    expect(machine.state).toBe("idle");
    expect(machine.value).toBe("idle");
  });
});

describe("MachineController transition graph (task 2.1)", () => {
  test("legal send transitions and updates introspection", () => {
    const machine = createMachine(baseConfig);

    expect(machine.send("FETCH")).toBe(true);

    expect(machine.state).toBe("loading");
    expect(machine.value).toBe("loading");
    expect(machine.is("loading")).toBe(true);
    expect(machine.is("idle")).toBe(false);
    expect(machine.can("FETCH")).toBe(false);
    expect(machine.cannot("FETCH")).toBe(true);
    expect(machine.can("DONE")).toBe(true);
    expect(machine.cannot("DONE")).toBe(false);
  });

  test("illegal send is a silent no-op with no emit", () => {
    const machine = createMachine(baseConfig);
    machine.send("FETCH");
    const details: Array<ChangeDetail<State>> = [];
    machine.on("change", (detail) => {
      details.push(detail);
    });

    expect(machine.send("RETRY")).toBe(false);

    expect(machine.state).toBe("loading");
    expect(details).toEqual([]);
  });

  test("unknown event name from the initial state is a silent no-op", () => {
    const machine = createMachine(baseConfig);
    const details: Array<ChangeDetail<State>> = [];
    machine.on("change", (detail) => {
      details.push(detail);
    });

    expect(machine.send("DONE")).toBe(false);

    expect(machine.state).toBe("idle");
    expect(details).toEqual([]);
  });
});

describe("MachineController sync guards (task 2.2)", () => {
  test("guard allow completes the transition and emits once", () => {
    const machine = createMachine({
      initial: "idle",
      transitions: [{ name: "FETCH", from: "idle", to: "loading", before: () => true }],
    });
    const details: Array<ChangeDetail<State>> = [];
    machine.on("change", (detail) => {
      details.push(detail);
    });

    expect(machine.send("FETCH")).toBe(true);

    expect(machine.state).toBe("loading");
    expect(details).toEqual([{ current: "loading", previous: "idle", source: "user" }]);
  });

  test("leave returning false cancels pre-enter with no state change", () => {
    const machine = createMachine({
      initial: "idle",
      transitions: [{ name: "FETCH", from: "idle", to: "loading", leave: () => false }],
    });
    const details: Array<ChangeDetail<State>> = [];
    machine.on("change", (detail) => {
      details.push(detail);
    });

    expect(machine.send("FETCH")).toBe(false);

    expect(machine.state).toBe("idle");
    expect(machine.can("FETCH")).toBe(true);
    expect(details).toEqual([]);
  });

  test("before returning false cancels with no state change and no emit", () => {
    const machine = createMachine({
      initial: "idle",
      transitions: [{ name: "FETCH", from: "idle", to: "loading", before: () => false }],
    });
    const details: Array<ChangeDetail<State>> = [];
    machine.on("change", (detail) => {
      details.push(detail);
    });

    expect(machine.send("FETCH")).toBe(false);

    expect(machine.state).toBe("idle");
    expect(details).toEqual([]);
  });

  test("void guard return allows the transition", () => {
    const machine = createMachine({
      initial: "idle",
      transitions: [
        {
          name: "FETCH",
          from: "idle",
          to: "loading",
          before: () => undefined,
          leave: () => undefined,
        },
      ],
    });

    expect(machine.send("FETCH")).toBe(true);

    expect(machine.state).toBe("loading");
  });
});

describe("MachineController change sources (task 2.3)", () => {
  test("send then reset emit user then reset details", async () => {
    const machine = createMachine(baseConfig);
    machine.mount();
    await flush();
    const details: Array<ChangeDetail<State>> = [];
    machine.on("change", (detail) => {
      details.push(detail);
    });
    machine.send("FETCH");

    machine.send("DONE");
    machine.reset();

    expect(details).toEqual([
      { current: "loading", previous: "idle", source: "user" },
      { current: "ready", previous: "loading", source: "user" },
      { current: "idle", previous: "ready", source: "reset" },
    ]);
    expect(machine.state).toBe("idle");
  });

  test("reset at the initial state is a silent no-op", async () => {
    const machine = createMachine(baseConfig);
    machine.mount();
    await flush();
    const details: Array<ChangeDetail<State>> = [];
    machine.on("change", (detail) => {
      details.push(detail);
    });

    machine.reset();

    expect(machine.state).toBe("idle");
    expect(details).toEqual([]);
  });
});

describe("MachineController init ordering (task 2.4)", () => {
  test("mount queues one initialization event via microtask", async () => {
    const machine = createMachine(baseConfig);
    const details: Array<ChangeDetail<State>> = [];
    machine.on("change", (detail) => {
      details.push(detail);
    });

    machine.mount();
    expect(details).toEqual([]);

    await flush();

    expect(details).toEqual([{ current: "idle", previous: "idle", source: "initialization" }]);
  });

  test("setSilently before the init microtask wins with no initialization emit", async () => {
    const machine = createMachine(baseConfig);
    const details: Array<ChangeDetail<State>> = [];
    machine.on("change", (detail) => {
      details.push(detail);
    });

    machine.setSilently("ready");
    machine.mount();
    await flush();

    expect(machine.state).toBe("ready");
    expect(details).toEqual([]);
  });

  test("destroy before the init microtask suppresses the initialization emit", async () => {
    const machine = createMachine(baseConfig);
    const details: Array<ChangeDetail<State>> = [];
    machine.on("change", (detail) => {
      details.push(detail);
    });

    machine.mount();
    machine.destroy();
    await flush();

    expect(details).toEqual([]);
  });

  test("setSilently with an unknown state throws instead of free-setting", () => {
    const machine = createMachine(baseConfig);

    expect(() => {
      machine.setSilently("archived" as State);
    }).toThrow();

    expect(machine.state).toBe("idle");
  });
});

describe("MachineController typed casts (task 9.1)", () => {
  test("forced wrong-state send via cast stays a silent no-op", () => {
    const machine = createMachine(baseConfig);
    const details: Array<ChangeDetail<State>> = [];
    machine.on("change", (detail) => {
      details.push(detail);
    });

    expect(machine.send("RETRY")).toBe(false);

    expect(machine.state).toBe("idle");
    expect(details).toEqual([]);
  });

  test("forState delegates to the machine with identical runtime behavior", () => {
    const machine = createMachine(baseConfig);
    const details: Array<ChangeDetail<State>> = [];
    machine.on("change", (detail) => {
      details.push(detail);
    });

    expect(machine.forState("idle").can("FETCH")).toBe(true);
    expect(machine.forState("idle").send("FETCH")).toBe(true);
    expect(machine.forState("idle").cannot("FETCH")).toBe(true);

    expect(machine.state).toBe("loading");
    expect(details).toEqual([{ current: "loading", previous: "idle", source: "user" }]);
  });
});

describe("MachineController destroy (task 2.5)", () => {
  test("double destroy freezes the machine with no emit and no throw", async () => {
    const machine = createMachine(baseConfig);
    machine.mount();
    await flush();
    machine.send("FETCH");
    const details: Array<ChangeDetail<State>> = [];
    machine.on("change", (detail) => {
      details.push(detail);
    });

    expect(() => {
      machine.destroy();
      machine.destroy();
    }).not.toThrow();

    expect(machine.send("FETCH")).toBe(false);
    expect(machine.state).toBe("loading");
    expect(machine.is("loading")).toBe(true);
    expect(details).toEqual([]);
  });

  test("reset and setSilently after destroy are no-ops", () => {
    const machine = createMachine(baseConfig);
    machine.send("FETCH");
    machine.destroy();

    expect(() => {
      machine.reset();
      machine.setSilently("ready");
    }).not.toThrow();

    expect(machine.state).toBe("loading");
  });
});
