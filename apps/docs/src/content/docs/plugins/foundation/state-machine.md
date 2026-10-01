---
title: State Machine
---

@ailura/alpinejs-state-machine

A transition graph for multi-step state: idle → loading → ready, with guards that can
refuse a transition. The plugin owns the graph; you fire events and read the state.

State machine ships an Alpine plugin factory like every other toolkit plugin. It
registers the `$machine` magic and nothing else — there is no `$store` entry.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-core @ailura/alpinejs-state-machine
```

Core is a peer: the magic is claimed through `guardMagic` from `@ailura/alpinejs-core/guards`.

## Register

`stateMachine()` is a factory: call it to get the `Alpine.plugin()` callback.

```ts
import Alpine from "alpinejs";
import stateMachine from "@ailura/alpinejs-state-machine";

Alpine.plugin(stateMachine());

Alpine.start();
```

The magic key defaults to `$machine`. Pass `{ magicKey }` to rename it.

```ts
Alpine.plugin(stateMachine({ magicKey: "fsm" }));
```

## Minimal example

A fetch flow with a failure branch and a retry.

```html
<div
  x-data="{
    m: $machine({
      initial: 'idle',
      transitions: [
        { name: 'FETCH', from: 'idle', to: 'loading' },
        { name: 'DONE', from: 'loading', to: 'ready' },
        { name: 'FAIL', from: 'loading', to: 'error' },
        { name: 'RETRY', from: 'error', to: 'loading' },
      ],
    }),
  }"
>
  <p>State: <strong x-text="m.state"></strong></p>

  <button @click="m.send('FETCH')" :disabled="!m.can('FETCH')">Load</button>
  <button x-show="m.is('loading')" @click="m.send('DONE')">Succeed</button>
  <button x-show="m.is('loading')" @click="m.send('FAIL')">Fail</button>
  <button x-show="m.is('error')" @click="m.send('RETRY')">Retry</button>
  <button x-show="m.is('ready') || m.is('error')" @click="m.reset()">Reset</button>
</div>
```

A transition only applies from the state its `from` names. `send()` returns whether it
committed, so a call that does not apply is a `false` instead of a throw — which is why
`can()` exists for disabling a button ahead of time.

## Each evaluation is a new instance

`$machine(config)` builds a **fresh** machine every time it is evaluated. That is
deliberate: two machines never share state, so a machine created per component is safe.

The flip side is that it must be evaluated once. Putting the factory call in a binding
expression creates a new machine on every render, and the state appears to reset
randomly.

```html
<!-- wrong: a new machine on every render -->
<span x-text="$machine({ initial: 'idle', transitions: [] }).state"></span>

<!-- right: build once in x-data -->
<div x-data="m: $machine({...})"></div>
```

## Guards

A transition can carry `before` and `leave` guards. Returning `false` from one cancels
the transition, which is how you stop a move the graph allows but the app should not.
`leave` runs while the machine is still in `from`, so it can veto the exit itself.

```js
{
  name: 'DONE',
  from: 'loading',
  to: 'ready',
  before: () => dataOk(),
}
```

A guard is a plain function the machine calls, so `this` inside it is not the component.
To read component state, build the machine in `x-init` and use a bare identifier — the
guard's closure then resolves it against Alpine's scope, reactively:

```html
<div
  x-data="{ allow: false, gated: null }"
  x-init="gated = $machine({
  initial: 'closed',
  transitions: [
    { name: 'OPEN', from: 'closed', to: 'open', before: () => allow },
  ],
})"
>
  <input type="checkbox" x-model="allow" />
  <button @click="gated.send('OPEN')">open</button>
</div>
```

`setSilently(state)` is the escape hatch when a state has to be restored outside the
graph: it moves the machine without emitting a change, and only accepts declared states —
an undeclared one throws.

## API reference

| Name               | Type     | Purpose                                               |
| ------------------ | -------- | ----------------------------------------------------- |
| `m.state`          | property | The current state. The only reactive data property.   |
| `m.value`          | property | An alias of `state`, for bindings.                    |
| `m.id`             | property | A unique id per instance.                             |
| `m.send(name)`     | method   | Fire a transition; returns whether it committed.      |
| `m.can(name)`      | method   | Whether there is an edge from the current state.      |
| `m.cannot(name)`   | method   | The negation of `can`.                                |
| `m.is(state)`      | method   | Whether the machine is in that state.                 |
| `m.forState(s)`    | method   | Narrow to the events valid from `s`; a typed handle.  |
| `m.reset()`        | method   | Return to `initial`.                                  |
| `m.setSilently(s)` | method   | Set the state without emitting; declared states only. |
| `m.dispose()`      | method   | Tear the instance down.                               |

The config is `{ initial, transitions }`, and each transition is
`{ name, from, to, before?, leave? }`.

:::caution[Call the factory: `Alpine.plugin(stateMachine())`]
The export is a factory — it returns the callback Alpine needs. Passing `stateMachine`
itself to `Alpine.plugin()` hands Alpine a function that returns another function, so
the magic is never registered and `$machine` is undefined on every component — with no
error at boot.
:::
