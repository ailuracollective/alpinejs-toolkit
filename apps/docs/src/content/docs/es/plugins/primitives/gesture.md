---
title: Gesture
---

@ailura/alpinejs-gesture

Gestos de pointer como directiva `x-gesture` con modificadores, más un store `gesture`
con los valores en vivo. Seis gestos: tap, doubletap, longpress, swipe, pan y pinch.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-gesture
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import gesturePlugin from "@ailura/alpinejs-gesture";

Alpine.plugin(gesturePlugin());

Alpine.start();
```

Eso registra la directiva `x-gesture` y el store `gesture`.

## Ejemplo mínimo

Una caja que reporta cada gesto a medida que ocurre.

```html
<div
  x-data
  x-gesture.tap="console.log('tap')"
  x-gesture.swipe="console.log('swipe', $store.gesture.distanceX, $store.gesture.distanceY)"
  x-gesture.pinch="console.log('scale', $store.gesture.scale)"
>
  <p>Activo: <span x-text="$store.gesture.active"></span></p>
  <p>Tipo: <span x-text="$store.gesture.kind"></span></p>
  <p>Dedos: <span x-text="$store.gesture.pointerCount"></span></p>
  <p>Prueba un tap, un swipe o un pinch.</p>
</div>
```

El modificador es el nombre del gesto y el valor es el handler. Varios pueden convivir en
un mismo elemento, que es la forma de distinguir un swipe de un pan sobre la misma
superficie.

Cada elemento que lleva `x-gesture` recibe su propio reconocedor, así que una página
con dos superficies no necesita una única compartida.

El handler se llama con el detalle del gesto como primer argumento y con el scope
fusionado de `x-data` como `this`, el mismo contrato que `x-on:click="handler"`:

```js
x-data="{
  onSwipe(d) {
    // `d.kind`, `d.direction`, `d.state`, `d.originalEvent`
    console.log(d.direction, this.$store.gesture.active);
  },
}"
```

:::caution[Una superficie de gestos necesita `touch-action: none`]
Un pinch de dos dedos sobre una página que todavía puede hacer pan o zoom se lo queda
el navegador: la página se mueve o hace zoom y el handler nunca se ejecuta. Pon
`touch-action: none` (Tailwind: `touch-none`) en la superficie, más
`user-select: none` (`select-none`) para que un long press no inicie una selección.
:::

## Los valores en vivo

`$store.gesture` tiene lo que el pointer está haciendo ahora mismo, que es lo que
necesitas para cualquier cosa visual: una posición de drag, un factor de escala vivo, una
dirección.

| Valor                                                 | Significado                                       |
| ----------------------------------------------------- | ------------------------------------------------- |
| `active` / `kind`                                     | Si hay un gesto corriendo, y cuál.                |
| `x` / `y`                                             | Posición actual del pointer.                      |
| `distanceX` / `distanceY` / `totalDistance`           | Cuánto se movió.                                  |
| `velocityX` / `velocityY`                             | Qué tan rápido.                                   |
| `scale` / `rotation`                                  | Pinch y rotación.                                 |
| `pointerCount` / `pointerType` / `button` / `buttons` | Cuántos dedos, y qué botón.                       |
| `direction`                                           | `"up"`, `"down"`, `"left"`, `"right"` o `"none"`. |

El store sigue a la superficie que se está tocando, y conserva los últimos valores de
esa superficie cuando el gesto termina. `scale` y `rotation` se miden desde la
separación y el ángulo con los que empezaron los dos dedos, así que valen `1` y `0`
hasta que hay un segundo dedo.

`cancel()` es la forma de cortar un gesto que el usuario no quiere: cancélalo cuando un
scroll anidado toma el control, así el handler tampoco dispara. Actúa sobre la
superficie en uso.

`pan` y `pinch` informan además una `phase` de `start`, `move` y luego `end`, para
que un elemento arrastrado o una transformación de zoom sigan el gesto y se asienten
al terminar.

## Ajustar los umbrales

Los defaults están afinados para touch. En una superficie donde un movimiento corto es
fácil por accidente, subí el umbral de swipe y el delay del long press.
`swipeThreshold` tiene default `50` px y `longPressDelay` `500` ms, así que los valores de
abajo son dos subidas.

```js
gesturePlugin({
  swipeThreshold: 80,
  longPressDelay: 600,
});
```

## Referencia de la API

| Nombre                                                               | Tipo      | Para qué sirve                                                                               |
| -------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------- |
| `x-gesture`                                                          | directiva | Los handlers. Modificadores: `.tap`, `.doubletap`, `.longpress`, `.swipe`, `.pan`, `.pinch`. |
| `$store.gesture.cancel()`                                            | método    | Abandonar el gesto en curso.                                                                 |
| `$store.gesture.active`                                              | store     | Si hay un gesto corriendo.                                                                   |
| `$store.gesture.kind`                                                | store     | El tipo reconocido, o `null`.                                                                |
| `$store.gesture.x` / `y`                                             | store     | Posición actual del pointer.                                                                 |
| `$store.gesture.distanceX` / `distanceY` / `totalDistance`           | store     | Cuánto se movió.                                                                             |
| `$store.gesture.velocityX` / `velocityY`                             | store     | Velocidad actual.                                                                            |
| `$store.gesture.scale` / `rotation`                                  | store     | Escala del pinch y rotación.                                                                 |
| `$store.gesture.pointerCount` / `pointerType` / `button` / `buttons` | store     | Detalles del pointer.                                                                        |
| `$store.gesture.direction`                                           | store     | `"up"`, `"down"`, `"left"`, `"right"` o `"none"`.                                            |

Las opciones del plugin incluyen `id`, `element`, `gestures`, `tapThreshold`,
`doubleTapInterval`, `longPressDelay`, `swipeThreshold`, `swipeVelocity`, `panThreshold`,
`preventDefault` y `mouseButtons`.

:::caution[Touch y mouse producen los mismos gestos]
Un handler escrito para touch también dispara con un trackpad o un mouse, y
`distanceX` en un drag de mouse es grande comparado con los defaults de touch. Si un drag
de desktop dispara de más, subí `swipeThreshold` en vez de bifurcar por `pointerType` en
cada handler.
:::
