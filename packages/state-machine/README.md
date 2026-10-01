# @ailura/alpinejs-state-machine

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-state-machine)](https://bundlephobia.com/package/@ailura/alpinejs-state-machine)

</p>

> N-state synchronous state machine for Alpine.js: you declare an `initial` state and a list of `(event, from, to)` edges once, and the illegal moves stop being expressible. Ships a pure `MachineController` for framework-agnostic use and a reactive `$machine(config)` magic for Alpine templates.

Depends only on `@ailura/alpinejs-core` (`BaseController` and `generateId`).

## Installation

```sh
pnpm add @ailura/alpinejs-state-machine alpinejs
# or
npm install @ailura/alpinejs-state-machine alpinejs
```

Requires `alpinejs@^3.0.0` as peer, plus `@ailura/alpinejs-core` for the
controller base — a **peer dependency** too, since no package in this toolkit
has a `dependencies` block. ESM only.

## Usage

This package registers **no store, no directive and no `x-machine` attribute**.
It registers exactly one thing: the `$machine` magic, and that magic is a
_factory_ — you call it with a config and it hands you back a machine.

### 1. Standalone (framework-agnostic)

`MachineController` is DOM-free and needs no Alpine at all.

```ts
import { MachineController, defineMachine } from "@ailura/alpinejs-state-machine";

const config = defineMachine({
  initial: "idle",
  transitions: [
    { name: "FETCH", from: "idle", to: "loading" },
    { name: "DONE", from: "loading", to: "ready" },
    { name: "FAIL", from: "loading", to: "error" },
    { name: "RETRY", from: "error", to: "loading" },
  ],
});

// `defineMachine` is an identity function that preserves the literal
// transition tuple, so per-state narrowing below is checked at compile time.
const machine = new MachineController(config);

machine.on("change", (detail) => {
  console.log(detail.previous, "→", detail.current, `(${detail.source})`);
});

machine.send("FETCH"); // true  — idle → loading
machine.send("DONE"); // true  — loading → ready
machine.send("FETCH"); // false — no FETCH edge from `ready`. Silent: no emit.

machine.state; // "ready"
machine.is("ready"); // true
machine.can("FETCH"); // false
machine.cannot("FETCH"); // true

machine.reset(); // → "idle", source: "reset"
machine.destroy();
machine.send("FETCH"); // false — a destroyed machine is frozen, never throws

// Typing, not runtime scoping: `forState` restricts which event *names*
// compile. The handle it returns is the machine itself, so `can()` inside it
// still looks at the machine's real state, not at the state you named.
machine.forState("error").can("RETRY"); // typechecks
machine.forState("error").can("DONE"); // compile error — no DONE edge from `error`
```

The `false` on line 3 and the `false` on the last line are different failures:
an **illegal send** has no edge at all, a **guard cancellation** has one that
refuses. `send()` returns `false` for both, so the `change` event and `state`
are the authoritative output.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import stateMachine from "@ailura/alpinejs-state-machine";

Alpine.plugin(stateMachine());
Alpine.start();
```

`$machine(config)` returns a **facade**: a reactive object with `state` as its
only reactive data property, plus the controller's methods. Evaluate it once
per component and reuse the result — every call builds a new machine.

```html
<div
  x-data="{
    m: $machine({
      initial: 'idle',
      transitions: [
        { name: 'FETCH', from: 'idle',    to: 'loading' },
        { name: 'DONE',  from: 'loading', to: 'ready' },
        { name: 'FAIL',  from: 'loading', to: 'error' },
        { name: 'RETRY', from: 'error',   to: 'loading' },
      ],
    }),
  }"
>
  <button @click="m.send('FETCH')" x-bind:disabled="!m.can('FETCH')">Fetch</button>
  <button @click="m.send('DONE')" x-bind:disabled="!m.can('DONE')">Resolve</button>
  <button @click="m.send('FAIL')" x-bind:disabled="!m.can('FAIL')">Reject</button>
  <button @click="m.send('RETRY')" x-bind:disabled="!m.can('RETRY')">Retry</button>
  <button @click="m.reset()">Reset</button>

  <p x-text="m.state"></p>
</div>
```

`can()`, `cannot()` and `is()` read the controller's private state, so the
plugin touches the reactive `state` inside each of them to register a
dependency. `x-bind:disabled="!m.can('DONE')"` therefore re-evaluates on its own
after a transition — no `$watch` anywhere.

### 3. Guards

`before` and `leave` are synchronous and receive the state being left. Returning
`false` cancels the edge before `to` is entered.

```html
<div
  x-data="{ allow: false, m: null, last: null }"
  x-init="m = $machine({
    initial: 'closed',
    transitions: [
      { name: 'OPEN',  from: 'closed', to: 'open',   before: () => allow },
      { name: 'CLOSE', from: 'open',   to: 'closed', leave:  (s) => s === 'open' },
    ],
  })"
>
  <label><input type="checkbox" x-model="allow" /> allow OPEN</label>
  <button @click="last = m.send('OPEN')">Open</button>
  <span x-text="last === null ? '—' : String(last)"></span>
  <span x-text="m.state"></span>
</div>
```

The config is built in `x-init` rather than inside the `x-data` object literal
because that is the only scope where `allow` is a resolvable name — see
[Limitations](#limitations).

`can('OPEN')` stays `true` while the guard refuses — it reports whether the
**edge exists**, not whether the guard would pass. That is deliberate: a guard
usually depends on data the transition graph cannot see, so `can()` answers the
graph question and `send()`'s return value answers the guard question.

### 4. Several machines, side by side

Nothing is shared: each evaluation gets its own controller, its own facade and
its own id from core's `generateId`.

```html
<div
  x-data="{
    list:   $machine({ initial: 'idle',   transitions: [{ name: 'LOAD', from: 'idle', to: 'loading' }] }),
    detail: $machine({ initial: 'locked', transitions: [{ name: 'OPEN', from: 'locked', to: 'open' }] }),
  }"
>
  <button @click="list.send('LOAD')">list</button>
  <span x-text="list.state"></span>
  <span x-text="list.id"></span>

  <button @click="detail.send('OPEN')">detail</button>
  <span x-text="detail.state"></span>
  <span x-text="detail.id"></span>
</div>
```

## API

| Export                            | Description                                                                                                                              | Type       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `MachineController`               | Pure N-state machine. `new MachineController(config)` — DOM-free, no Alpine                                                              | `class`    |
| `defineMachine`                   | Identity function that captures the literal state/event unions **and** the transition tuple, so `forState` can narrow. Erased at runtime | `function` |
| `stateMachine`                    | `Alpine.plugin()` factory — `stateMachine(options?) => (alpine) => void`. Registers the `$machine` magic via `guardMagic`                | `function` |
| `default`                         | Alias of `stateMachine`                                                                                                                  | `function` |
| `DEFAULT_STATE_MACHINE_MAGIC_KEY` | `"machine"` — the default `$machine` key                                                                                                 | `string`   |
| `MachineFacade`                   | What `$machine(config)` returns                                                                                                          | `type`     |
| `StateMachinePluginCallback`      | `(alpine: Alpine) => void` — the `Alpine.plugin()` callback                                                                              | `type`     |
| `MachineConfig`                   | `{ initial, transitions }`                                                                                                               | `type`     |
| `Transition`                      | One edge: `{ name, from, to, before?, leave? }`                                                                                          | `type`     |
| `SyncGuard`                       | `(state: S) => boolean \| void` — `false` cancels. A zero-arg `() => true` stays assignable                                              | `type`     |
| `ChangeDetail`                    | `{ current, previous, source }`                                                                                                          | `type`     |
| `StateSource`                     | `'user' \| 'reset' \| 'initialization'`                                                                                                  | `type`     |
| `MachineEvents`                   | `{ change: [detail: ChangeDetail<S>] }` — the controller's event map                                                                     | `type`     |
| `PluginOptions`                   | `{ magicKey? }`                                                                                                                          | `type`     |
| `DefinedMachineConfig`            | `MachineConfig` plus the literal transition tuple — the return of `defineMachine`                                                        | `type`     |
| `ScopedMachineHandle`             | `{ send, can, cannot }` narrowed to one state's events — the return of `forState`                                                        | `type`     |
| `EventsFrom` / `StateEvents`      | `Extract<T, { from: S }>['name']` — the event names valid from `S` in a transition tuple                                                 | `type`     |
| `ScopedEvents`                    | `EventsFrom` when the tuple is known, else the full `E` union — so `forState` never collapses to `never`                                 | `type`     |

### Controller and facade

Both `MachineController` and the `$machine` facade expose the same core surface;
the facade adds `dispose()` and makes `state` reactive.

| Member                  | Returns                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                    | Instance id from core's `generateId("machine")` — distinct per `$machine(config)` evaluation                                                               |
| `state`                 | Current state. On the facade this is **the only reactive data property**, written once per committed transition                                            |
| `value`                 | Alias of `state`, as a read-through getter — the write to `state` updates both                                                                             |
| `send(name)`            | `true` when the edge committed. `false` for an illegal send, a guard cancellation, and any send after `destroy()`/`dispose()`                              |
| `can(name)`             | Whether `(name, current)` has an edge. **`false` after destroy.`** It does not evaluate `before`/`leave`                                                   |
| `cannot(name)`          | `!can(name)`                                                                                                                                               |
| `is(state)`             | Whether the machine is in `state`. Still `true` after destroy — it is a plain comparison                                                                   |
| `forState(state)`       | Type-only narrowing. Returns `this` — no new closures, no extra subscription, zero added runtime behaviour                                                 |
| `reset()`               | Back to `initial` with `source: 'reset'`. Silent no-op when already there, and after destroy                                                               |
| `setSilently(state)`    | Sets the state with **no emit**, and marks the machine hydrated so a pending init microtask is suppressed. **Throws** on a state the config never declares |
| `dispose()`             | Facade only. Idempotent: unsubscribe the `change` listener and destroy the controller. Also wired to the element's `cleanup()`                             |
| `mount()` / `destroy()` | Inherited from `BaseController`. `mount()` queues one microtask that emits `source: 'initialization'`                                                      |
| `on('change', fn)`      | Subscribe; the unsubscribe also runs on `destroy()`/`dispose()`                                                                                            |

### Options

The plugin takes one option, because the transition graph is not a registration
concern — it is the per-evaluation argument to the magic, so N machines with
different graphs coexist under one key.

```ts
type PluginOptions = {
  magicKey?: string; // default: DEFAULT_STATE_MACHINE_MAGIC_KEY ("machine")
};

Alpine.plugin(stateMachine({ magicKey: "fsm" })); // → $fsm(config)
```

The config itself is plain data:

```ts
type MachineConfig<S extends string, E extends string> = {
  initial: S;
  transitions: ReadonlyArray<Transition<S, E>>;
};

type Transition<S extends string, E extends string> = {
  name: E;
  from: S;
  to: S;
  before?: SyncGuard<S>; // runs before entering `to`; false cancels
  leave?: SyncGuard<S>; // runs while leaving `from`; false cancels
};
```

A self-loop (`from === to`) is allowed and emits a `change` with
`current === previous` — nothing in the code rejects it.

## Events

`MachineController` emits one event. The facade subscribes to it and writes
`state`; it does not re-emit.

```ts
import type { ChangeDetail, StateSource } from "@ailura/alpinejs-state-machine";

machine.on("change", (detail: ChangeDetail<"idle" | "loading" | "ready">) => {
  detail.current; // 'idle' | 'loading' | 'ready'
  detail.previous;
  detail.source; // StateSource: 'user' | 'reset' | 'initialization'
});
```

`source: 'initialization'` fires exactly once, from a microtask queued by
`mount()`. It is suppressed if `setSilently()` or `destroy()` ran first, and it
does not survive to the facade: the plugin writes `state` on every `change`, so
the init emit writes the state it already had. Through `$machine` you will
therefore only ever see `'user'` and `'reset'`.

## SSR

> SSR-safe by construction — no `window`/`document` at import time, and neither
> does any call. `MachineController` touches nothing outside the module; the
> plugin never imports Alpine, it takes the instance as a parameter. The `$machine`
> magic callback only runs when Alpine evaluates an expression, which is a
> client-side event.

## Integration

- **`@ailura/alpinejs-theme`** — a three-state machine (`light` / `dark` /
  `system`) with six edges, using `setSilently()` to hydrate from storage before
  the init microtask fires. The reference consumer of this package.
- **Your own store** — the machine has no Alpine surface of its own, so a store
  is consumer-owned: create the machine in your controller, mirror `change` into
  your store, and call `dispose()` from your `destroy()`.

## Limitations

- **No store, no directive, no `x-machine` attribute.** The only Alpine
  registration is the `$machine` magic. If you were expecting `$store.machine`
  or `x-machine="…"`, neither exists.
- **`can()` does not run guards.** It answers "is there an edge from here?", so
  a `:disabled="!m.can('OPEN')"` button stays enabled while a `before` guard
  refuses every send. Use `send()`'s return value for the guard's answer.
- **`forState` is compile-time only.** It is a cast: the returned handle _is_ the
  machine, not a scoped proxy, so a wrong-state `send()` through
  `forState('idle').send('DONE')` while the machine is in `loading` typechecks
  only if the edge exists, and behaves exactly as an unscoped `send()` would.
  `forState` is only as narrow as the tuple it can see — build the machine with
  `defineMachine` (or a `const` type parameter), or it falls back to the full
  event union.
- **A guard inlined in `x-data` cannot read its sibling properties.**
  `x-data="{ allow: false, m: $machine({ …, before: () => this.allow }) }"` looks
  correct and is not: inside the object literal `this` is not the data proxy, so
  `this.allow` is `undefined`, the guard returns falsy, and every send is
  silently cancelled. Build the config in `x-init` instead, where `allow` is a
  resolvable name in the evaluation scope — or close over an Alpine `x-data`
  method (`before: () => this.isAllowed()` works only because the method is
  called on the proxy).
- **`setSilently` throws** on a state the config never declares. That is
  deliberate — it is the only way to write a state and it refuses free-setting —
  but it means a state loaded from an unvalidated external source (a stored
  string, a URL segment) will throw at the call site.
- **`reset()` is not symmetric with `send()`.** It returns `void`, emits nothing
  when the machine is already at `initial`, and is frozen after `destroy()`.
- **No context, no history, no nested states, no async transitions.** A guard is
  a synchronous `boolean`; an async step is a transition you `send` yourself from
  a `Promise`. There is no `context` object, no `subscribe()`, no `matches()`,
  and no `onTransition` side effect beyond the `change` event.
- **A `change` subscription is per machine.** Nothing replays past transitions to
  a late subscriber, so a component that mounts mid-flight reads `state` and
  nothing else.
- **The declared gzip budget is met, but the raw size is not the headline.**
  `2.30 kB raw` against a `1.5 kB` `size-limit` entry is fine — the entry
  measures gzipped output — but it means the budget is only enforced on the
  compressed figure.

## Size

`2.30 kB raw / 0.99 kB gzip` (single entry `dist/index.mjs`, minified, gzip 9) · budget `1.5 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

One `size-limit` entry covers the whole package: `machine.ts` and `plugin.ts` are
one output, because the magic bridge is a few hundred bytes of the same graph and
splitting them would only create a second budget to miss.

## Architecture

[Foundation layer](../../ARCHITECTURE.md) — a Foundation package that registers
no store: the machine is pure state and the reactive bridge is consumer-owned.
`MachineController extends BaseController`, so it inherits the
`idle → mounted → destroyed` lifecycle and the LIFO teardown stack. See
[ARCHITECTURE.md §4.4](../../ARCHITECTURE.md).

## Testing

```sh
pnpm exec vp test packages/state-machine
pnpm exec tsc --noEmit -p packages/state-machine/tsconfig.json
```

Uses `@ailura/alpinejs-testing` — `start(stateMachine())` in `beforeAll`,
`resume()` in `beforeEach`, `reset()` in `afterEach`. See
[ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
