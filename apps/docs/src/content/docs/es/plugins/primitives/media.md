---
title: Media
---

@ailura/alpinejs-media

Un store `media` con el tamaño del viewport, el breakpoint actual, el esquema oscuro y
el movimiento reducido. Escucha las media queries del propio browser, así que no hay
polling.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-media
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import mediaPlugin from "@ailura/alpinejs-media";

Alpine.plugin(mediaPlugin());

Alpine.start();
```

Eso registra un store `media`, así que todo lo de abajo vive en `$store.media`.

## Ejemplo mínimo

Lee el tamaño y la preferencia de oscuro directo en el markup.

```html
<div x-data>
  <p>
    Viewport: <span x-text="$store.media.width"></span> ×
    <span x-text="$store.media.height"></span>
  </p>
  <p>Breakpoint: <span x-text="$store.media.breakpoint"></span></p>
  <p>Oscuro: <span x-text="$store.media.isDark"></span></p>
  <p>Movimiento reducido: <span x-text="$store.media.prefersReducedMotion"></span></p>
</div>
```

Los valores son reactivos. `width`, `height` y `breakpoint` vienen de un listener de
`resize` con debounce (`debounceMs`, 50 por defecto); `prefersReducedMotion` e `isDark`
vienen de las media queries del propio browser.

## Respetar el movimiento reducido

Este es el que realmente vas a usar. Bloquea lo que anima, y sé explícito con el
fallback, porque el valor es `true` para quien pidió menos movimiento y para nadie más.

```html
<div
  x-data="{ open: false }"
  x-effect="$watch('$store.media.prefersReducedMotion', (reduce) => { if (reduce) open = true; })"
>
  <div x-show="open" x-transition.opacity.duration.200ms>
    <span x-show="!$store.media.prefersReducedMotion" x-transition.opacity.duration.200ms>
      Un panel que entra deslizando.
    </span>
    <span x-show="$store.media.prefersReducedMotion">Un panel que no entra.</span>
  </div>
</div>
```

## Leer la preferencia cruda

`prefersColorScheme` es lo que pidió el usuario; `isDark` es el booleano resuelto. En el
browser el controller solo reporta `light` o `dark` — `no-preference` es el valor que
reporta cuando no hay window a consultarle, así que aparece en el markup del server antes
de la hidratación.

```html
<p>Pedido: <span x-text="$store.media.prefersColorScheme"></span></p>
<p>Resuelto: <span x-text="$store.media.isDark"></span></p>
```

## Referencia de la API

| Nombre                              | Tipo   | Para qué sirve                                 |
| ----------------------------------- | ------ | ---------------------------------------------- |
| `$store.media.width`                | store  | Ancho del viewport, en píxeles.                |
| `$store.media.height`               | store  | Alto del viewport, en píxeles.                 |
| `$store.media.breakpoint`           | store  | El nombre del breakpoint actual.               |
| `$store.media.prefersReducedMotion` | store  | Si el usuario pidió movimiento reducido.       |
| `$store.media.prefersColorScheme`   | store  | `light`, `dark` o `no-preference`.             |
| `$store.media.isDark`               | store  | El booleano de oscuro ya resuelto.             |
| `$store.media.refresh()`            | método | Releer todas las queries. Rara vez hace falta. |
| `$store.media.destroy()`            | método | Desconectar los listeners.                     |

:::note[`prefersColorScheme` e `isDark` responden preguntas distintas]
Vincula a `isDark` para decidir qué renderizar, y leé `prefersColorScheme` cuando quieras
etiquetar la preferencia en sí. El único caso en que divergen es el `no-preference` del
server, que resuelve a `isDark: false` hasta que el browser reporte un esquema.
:::

## Opciones del plugin

```ts
mediaPlugin({ id: "app-media", storeKey: "viewport" });
```
