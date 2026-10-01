---
title: State Machine
---

@ailura/alpinejs-state-machine

Un grafo de transiciones para estado de varios pasos: idle → loading → ready, con guardas
que pueden rechazar una transición. El plugin maneja el grafo; tú disparas eventos y
lees el estado.

State machine trae una factory de plugin de Alpine como todos los demás plugins del
toolkit. Registra el magic `$machine` y nada más — no hay entrada en `$store`.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-core @ailura/alpinejs-state-machine
```

Core es un peer: el magic se reclama con `guardMagic` de `@ailura/alpinejs-core/guards`.

## Registrar

`stateMachine()` es una factory: la llamás para obtener el callback de `Alpine.plugin()`.

```ts
import Alpine from "alpinejs";
import stateMachine from "@ailura/alpinejs-state-machine";

Alpine.plugin(stateMachine());

Alpine.start();
```

El magic se llama `$machine` por defecto. Pasa `{ magicKey }` para renombrarlo.

```ts
Alpine.plugin(stateMachine({ magicKey: "fsm" }));
```

## Ejemplo mínimo

Un flujo de fetch con una rama de error y un reintento.

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
  <p>Estado: <strong x-text="m.state"></strong></p>

  <button @click="m.send('FETCH')" :disabled="!m.can('FETCH')">Cargar</button>
  <button x-show="m.is('loading')" @click="m.send('DONE')">Éxito</button>
  <button x-show="m.is('loading')" @click="m.send('FAIL')">Fallo</button>
  <button x-show="m.is('error')" @click="m.send('RETRY')">Reintentar</button>
  <button x-show="m.is('ready') || m.is('error')" @click="m.reset()">Reset</button>
</div>
```

Una transición solo aplica desde el estado que nombra su `from`. `send()` devuelve si
se completó, así que una llamada que no aplica es un `false` en lugar de una excepción:
por eso existe `can()` para deshabilitar un botón antes de tiempo.

## Cada evaluación es una instancia nueva

`$machine(config)` construye una máquina **nueva** cada vez que se evalúa. Es
intencional: dos máquinas nunca comparten estado, así que una creada por componente es
segura.

La contracara es que hay que evaluarla una sola vez. Poner la llamada en una expresión de
binding crea una máquina nueva en cada render, y el estado parece reiniciarse al azar.

```html
<!-- mal: una maquina nueva en cada render -->
<span x-text="$machine({ initial: 'idle', transitions: [] }).state"></span>

<!-- bien: construir una vez en x-data -->
<div x-data="m: $machine({...})"></div>
```

## Guardas

Una transición puede llevar las guardas `before` y `leave`. Devolver `false` desde una
cancela la transición, que es la forma de frenar un movimiento que el grafo permite pero
la app no debería hacer. `leave` corre mientras la máquina todavía está en `from`, así
que puede vetar la salida en sí.

```js
{
  name: 'DONE',
  from: 'loading',
  to: 'ready',
  before: () => dataOk(),
}
```

Una guarda es una función común que la máquina invoca, así que `this` adentro no es el
componente. Para leer estado del componente, creá la máquina en `x-init` y usá un
identificador pelado: el closure de la guarda lo resuelve contra el scope de Alpine, de
forma reactiva:

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
  <button @click="gated.send('OPEN')">abrir</button>
</div>
```

`setSilently(state)` es la salida cuando un estado hay que restaurarlo fuera del grafo:
mueve la máquina sin emitir un change, y solo acepta estados declarados — uno no
declarado tira.

## Referencia de la API

| Nombre             | Tipo      | Para qué sirve                                          |
| ------------------ | --------- | ------------------------------------------------------- |
| `m.state`          | propiedad | El estado actual. La única propiedad de datos reactiva. |
| `m.value`          | propiedad | Un alias de `state`, para bindings.                     |
| `m.id`             | propiedad | Un id único por instancia.                              |
| `m.send(name)`     | método    | Dispara una transición; devuelve si se aplicó.          |
| `m.can(name)`      | método    | Si hay una arista desde el estado actual.               |
| `m.cannot(name)`   | método    | La negación de `can`.                                   |
| `m.is(state)`      | método    | Si la máquina está en ese estado.                       |
| `m.forState(s)`    | método    | Narrow a los eventos válidos desde `s`; handle tipado.  |
| `m.reset()`        | método    | Vuelve a `initial`.                                     |
| `m.setSilently(s)` | método    | Fija el estado sin emitir; solo estados declarados.     |
| `m.dispose()`      | método    | Desarma la instancia.                                   |

La config es `{ initial, transitions }`, y cada transición es
`{ name, from, to, before?, leave? }`.

:::caution[Llámala como factory: `Alpine.plugin(stateMachine())`]
El export es una factory — devuelve el callback que Alpine necesita. Si le pasás
`stateMachine` directamente a `Alpine.plugin()`, Alpine recibe una función que devuelve
otra función, así que el magic nunca se registra y `$machine` es `undefined` en todos los
componentes — sin ningún error al arrancar.
:::
