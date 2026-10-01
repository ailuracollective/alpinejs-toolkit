---
title: Timer
---

@ailura/alpinejs-timer

Un magic `$timer` para countdowns, countups y cronómetros. El plugin maneja el
drift: programa contra timestamps en vez de contar ticks, así que una pestaña en segundo
plano no hace que un timer de 30 segundos salte.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-timer
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import timerPlugin from "@ailura/alpinejs-timer";

Alpine.plugin(timerPlugin());

Alpine.start();
```

Eso registra el magic `$timer`. No hay store.

## Ejemplo mínimo

Un countdown de 30 segundos que arranca con un click.

```html
<div x-data="{ tm: $timer.countdown({ duration: 30000 }) }">
  <p>Quedan <span x-text="tm.formatted"></span></p>
  <p>Progreso: <span x-text="Math.round(tm.progress * 100) + '%'"></span></p>

  <button @click="tm.start()">Arrancar</button>
  <button @click="tm.pause()">Pausar</button>
  <button @click="tm.restart()">Reiniciar</button>
</div>
```

Cada factory toma un objeto de opciones y devuelve un timer nuevo. Constrúyelo una vez en
`x-data` y manéjalo con `tm`, porque un timer construido dentro de una expresión de
binding se recrea en cada render.

## Elegir un tipo

- `countdown({ duration })` — cuenta hacia atrás desde una duración. `duration` es
  obligatorio.
- `countup({ limit })` — cuenta hacia arriba hasta un límite, útil para una barra de
  progreso.
- `stopwatch()` — cuenta hacia arriba sin objetivo.
- `create({ direction })` — la factory general, `'up'` o `'down'`.

```js
$timer.countdown({ duration: 30000 });
$timer.countup({ limit: 30000 });
$timer.stopwatch();
```

:::caution[`$timer.stopwatch()` vuelve sin sus controles]
El magic construye la vista del stopwatch copiando los métodos definidos directamente en
la clase del stopwatch, lo que deja fuera todo lo que hereda de la clase del timer. Obtenés
`lap` y los campos reactivos, pero `start()`, `pause()`, `reset()` y `toggle()` son
`undefined` en ese objeto, así que un stopwatch creado por el magic nunca se puede arrancar.
Usá `countdown()`, `countup()` o `create()` para el magic, y armá el stopwatch con la
factory suelta cuando necesites vueltas:

```ts
import { createStopwatch } from "@ailura/alpinejs-timer";

const sw = createStopwatch(); // superficie completa: start, pause, reset, lap, …
sw.start();
```

:::

## Variantes

**Un control que hace todo.** `toggle()` alterna entre corriendo y pausado, `reset()`
vuelve a cero y detiene, y `restart()` vuelve y arranca.

```js
tm.toggle();
tm.reset();
tm.restart();
```

**Observar la finalización.** Pasale `onComplete` (o `onTick`) y el timer te llama
cuando llega al final, así no tenés que consultar `remaining` en un loop.

```js
$timer.countdown({ duration: 30000, onComplete: () => celebrate() });
```

**Registrar vueltas en un cronómetro.** `createStopwatch()` también lleva las vueltas,
con la más rápida y la más lenta ya calculadas.

```ts
import { createStopwatch } from "@ailura/alpinejs-timer";

const sw = createStopwatch();
sw.start();
sw.lap();
sw.laps; // todas las vueltas
sw.lastLap; // la más reciente
sw.fastestLap; // la más rápida hasta ahora
```

## Referencia de la API

Cada método de abajo está en el objeto que devuelven `$timer.countdown()`,
`$timer.countup()` y `$timer.create()`, que en los ejemplos llamamos `tm`.

| Nombre         | Tipo   | Para qué sirve                                             |
| -------------- | ------ | ---------------------------------------------------------- |
| `tm.formatted` | store  | El tiempo como string para mostrar.                        |
| `tm.remaining` | store  | Milisegundos restantes, o `null` cuando no hay `duration`. |
| `tm.elapsed`   | store  | Milisegundos transcurridos.                                |
| `tm.duration`  | store  | El objetivo en milisegundos.                               |
| `tm.progress`  | store  | De 0 a 1, para una barra de progreso.                      |
| `tm.running`   | store  | Si está corriendo.                                         |
| `tm.paused`    | store  | Si está pausado.                                           |
| `tm.completed` | store  | Si llegó al final.                                         |
| `tm.direction` | store  | `'up'` o `'down'`.                                         |
| `tm.iteration` | store  | Cuántas veces reinició un timer que se repite.             |
| `tm.start()`   | método | Arrancar, o retomar después de una pausa.                  |
| `tm.pause()`   | método | Pausar.                                                    |
| `tm.resume()`  | método | Retomar desde la pausa.                                    |
| `tm.toggle()`  | método | Arrancar si está pausado, pausar si está corriendo.        |
| `tm.reset()`   | método | Volver a cero, detenido.                                   |
| `tm.restart()` | método | Volver a cero y arrancar.                                  |
| `tm.destroy()` | método | Desarmar el timer.                                         |

:::caution[Un timer construido en un binding nunca avanza]
`x-text="$timer.countdown({ duration: 30000 }).formatted"` construye un timer nuevo en
cada evaluación, así que el tiempo mostrado se reinicia constantemente y parece
aleatorio. Asígnalo una vez al estado del componente y lee desde ahí.
:::

## Desarme

Un timer construido en una expresión de template pertenece al elemento sobre el que
está esa expresión. Cuando Alpine saca ese elemento del árbol, la vista se desarma sola:
se limpia el timeout pendiente y el controller queda destruido, así que ya no puede
avanzar ni se puede volver a arrancar con `start()`. Esto cubre el caso de `x-data` de
arriba, donde el timer vive y muere con el componente donde fue declarado.

:::caution[Un timer construido desde JavaScript no tiene elemento que muera]
Si llamás a una factory desde un handler, un callback o tu propio módulo, no corrió
ningún magic callback para ese elemento, así que no hay cleanup donde registrar la
liberación. La vista vuelve igual completamente usable — `start()`, `pause()` y los
campos reactivos funcionan — pero nada la va a liberar por usted. Es tuya: llamá a
`tm.destroy()` (o `tm.dispose()`) cuando termines.
:::

## Opciones del plugin

```ts
timerPlugin({ magicKey: "stopwatch" });
```

`magicKey` tiene default `timer`. Las opciones que acepta cada factory son `direction`,
`duration`, `limit` (count-up), `initialElapsed`, `autoStart`, `precision` (default
`16`), `repeat`, `format`, `onTick` y `onComplete`.
