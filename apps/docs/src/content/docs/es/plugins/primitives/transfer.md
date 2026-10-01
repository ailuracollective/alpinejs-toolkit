---
title: Transfer
---

@ailura/alpinejs-transfer

Tres magics para sacar datos de la página: `$clipboard`, `$share` y `$export`. Cada uno
es una función, y el browser rechaza cada uno en algún contexto, así que cada uno tiene
una forma de preguntar antes.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-transfer
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import transferPlugin from "@ailura/alpinejs-transfer";

Alpine.plugin(transferPlugin());

Alpine.start();
```

Eso registra tres magics. No hay store.

## Ejemplo mínimo

Copiar un comando, compartir la página, y exportar una config — cada uno con su chequeo.

```html
<div x-data="{ copied: false }">
  <button
    @click="$clipboard('pnpm add alpinejs @ailura/alpinejs-accordion').then(() => (copied = true))"
  >
    Copiar el comando de instalación
  </button>
  <span x-show="copied">Copiado.</span>

  <button
    x-show="$share.isSupported"
    @click="$share({ title: 'Alpine.js Toolkit', url: location.href })"
  >
    Compartir
  </button>

  <button
    @click="$export(JSON.stringify(config), { filename: 'config.json', mimeType: 'application/json' })"
  >
    Exportar
  </button>
</div>
```

Los tres son async y los tres devuelven una promesa, así que el `.then()` es trabajo real
y no decoración: una escritura al clipboard falla en silencio en un origin inseguro, y esto
es la forma de enterarte. `$export()` resuelve `false` en vez de tirar cuando la descarga
no puede pasar, y un source string sin filename es uno de esos casos.

## Cada magic tiene dos estáticas

Son propiedades de la función, no métodos de un objeto. Leelas como propiedades.

| magic     | Static           | Tipo      | Meaning                                          |
| --------- | ---------------- | --------- | ------------------------------------------------ |
| `$share`  | `isSupported`    | propiedad | La Web Share API está disponible.                |
| `$share`  | `canShare(data)` | método    | Si ese payload en particular se puede compartir. |
| `$export` | `isSupported`    | propiedad | La descarga de archivos está disponible.         |

`$clipboard` no tiene estáticas. Es una función y nada más.

:::caution[`canShare` es el que todos se saltan]
`$share.isSupported` solo te dice que el browser tiene la API. Puede igual rechazar un
payload más grande que un archivo, o uno cuya URL el browser no trata como compartible.
Cuando compartes datos estructurados, pregunta `canShare(data)` y caé al clipboard en
lugar de ofrecer un botón que no hace nada.
:::

## Referencia de la API

| magic                       | Tipo    | Para qué sirve                                                                                    |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `$clipboard(text, mode?)`   | función | Copiar texto. Devuelve una promesa. `mode` es `'auto'`, `'clipboard'` o `'legacy'`, o `{ mode }`. |
| `$share(data)`              | función | Compartir vía la Web Share API. Devuelve una promesa.                                             |
| `$export(source, options?)` | función | Descargar un `string`, `Blob` o `File` como archivo. Devuelve una promesa.                        |

`options` de `$export()` es `{ filename, mimeType }` o solo el filename como string. Un
`Blob` o `File` usa su propio nombre (`export` para un blob sin nombre), así que no
necesita options; un string sí.

## Opciones del plugin

```ts
transferPlugin({
  clipboardKey: "copy",
  shareKey: "share",
  exportKey: "download",
});
```
