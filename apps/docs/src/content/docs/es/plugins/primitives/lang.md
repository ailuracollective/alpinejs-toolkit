---
title: Lang
---

@ailura/alpinejs-lang

Un store `lang` con el idioma actual, detectado del browser y cambiable en runtime. El
plugin maneja la detección y la normalización; tú renderizas la copia.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-lang
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import langPlugin from "@ailura/alpinejs-lang";

Alpine.plugin(langPlugin());

Alpine.start();
```

Eso registra un store `lang`, así que todo lo de abajo vive en `$store.lang`.

## Ejemplo mínimo

Detectar al cargar, dejar cambiar al usuario, y tener un fallback cuando el tag no está
disponible.

```html
<div x-data>
  <p>
    Actual: <span x-text="$store.lang.current"></span> (<span x-text="$store.lang.base"></span
    >-<span x-text="$store.lang.region"></span>)
  </p>
  <p>Detectado del browser: <span x-text="$store.lang.isDetected"></span></p>

  <button @click="$store.lang.set('es-AR')">Español</button>
  <button @click="$store.lang.set('en-US')">English</button>
  <button @click="$store.lang.reset()">Volver al detectado</button>
</div>
```

`isDetected` es la que hay que bifurcar. Es `false` cuando el idioma vino de tu propio
fallback y no del usuario, y Decirle "English" a alguien que nunca lo eligió es un
riesgo real.

## Normalizar los tags

`normalize` decide qué cuenta como el mismo idioma. Con eso prendido, `es`, `es-AR` y
`es-MX` se tratan como el mismo idioma base, que es lo que quieres en un sitio que tiene
una sola traducción de español.

```ts
langPlugin({ normalize: true });
```

Apagalo cuando la región cambie de verdad la copia — moneda, formatos de fecha, o texto
legal distinto.

## Chequear antes de bifurcar

`is(tag)` e `includes(tag)` son lo que hay que usar en vez de comparar strings, porque
respetan la normalización que configuraste. `is()` responde por el tag activo;
`includes()` responde por la lista de idiomas preferidos del browser.

```js
$store.lang.is("es"); // true si el idioma actual es español, en cualquier región
$store.lang.includes("es-AR"); // true si el usuario prefiere es-AR en algún momento
```

`base`, `region`, `languages` y `fallback` son todos legibles, así que puedes armar un
selector de idioma sin hardcodear la lista.

## Referencia de la API

| Nombre                      | Tipo   | Para qué sirve                                       |
| --------------------------- | ------ | ---------------------------------------------------- |
| `$store.lang.current`       | store  | El tag de idioma activo.                             |
| `$store.lang.base`          | store  | El idioma base, ej. `es` para `es-AR`.               |
| `$store.lang.region`        | store  | La región, o `null`.                                 |
| `$store.lang.languages`     | store  | Los idiomas que prefiere el usuario, en orden.       |
| `$store.lang.fallback`      | store  | El idioma usado cuando nada coincide.                |
| `$store.lang.isDetected`    | store  | Si el idioma actual vino del browser.                |
| `$store.lang.set(tag)`      | método | Cambiar el idioma.                                   |
| `$store.lang.reset()`       | método | Volver al idioma detectado.                          |
| `$store.lang.is(tag)`       | método | Si el idioma actual es este.                         |
| `$store.lang.includes(tag)` | método | Si los idiomas preferidos del usuario incluyen este. |

## Opciones del plugin

```ts
langPlugin({ fallback: "en-US", normalize: true });
```
