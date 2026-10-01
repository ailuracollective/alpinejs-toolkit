---
title: Keyboard
---

@ailura/alpinejs-keyboard

Un registro de atajos con scopes nombrados, para que un modal pueda tomar el teclado y
devolverlo al cerrarse. El plugin maneja el matching y los conflictos; tú vinculas un
handler y registras los atajos.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-keyboard
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import keyboardPlugin from "@ailura/alpinejs-keyboard";

Alpine.plugin(keyboardPlugin());

Alpine.start();
```

Eso registra un store `keyboard`, así que todo lo de abajo vive en `$store.keyboard`.

## Ejemplo mínimo

Un handler global, y los atajos registrados contra él.

```html
<div
  x-data="{ stop: null }"
  x-init="
    $store.keyboard.register('mod+s', () => save(), { id: 'save', scope: 'editor' });
  "
>
  <p>Scopes activos: <span x-text="$store.keyboard.activeScopes"></span></p>
  <p>Atajos: <span x-text="$store.keyboard.commands.map((c) => c.shortcut).join(', ')"></span></p>

  <button @click="$store.keyboard.activateScope('editor')">Activar atajos</button>
  <button @click="$store.keyboard.deactivateScope('editor')">Desactivarlos</button>
</div>
```

**`register()` devuelve una función de baja, no un handle.** También acepta un `id`, y
`unregister(id)` es lo que quita un atajo por nombre. Guardá la función devuelta cuando
querás una baja atada al teardown; usá el `id` cuando necesitás quitarlo desde otro
lado.

```js
const stop = $store.keyboard.register("mod+s", save, { id: "save" });
stop(); // igual que $store.keyboard.unregister("save")
```

## Los scopes son el punto

Un scope es un conjunto con nombre de atajos que puedes encender y apagar. Así es como un
dialog toma el teclado sin que los atajos de la página se disparen por debajo. Un atajo
dispara cuando alguno de sus scopes está activo, así que uno registrado en `default` y
otro en `dialog` sólo compiten cuando los dos scopes están encendidos.

```js
$store.keyboard.activateScope("editor");
$store.keyboard.deactivateScope("editor");
```

`suspendScope()` es el interruptor más suave: deja el scope activo pero bloquea sus
atajos, así que `resumeScope()` restituye exactamente lo que había.

## Resolver conflictos

`priority` decide cuál de dos atajos que matchean gana. Asigna el número más alto al más
específico.

```js
$store.keyboard.register("escape", closeDialog, { scope: "dialog", priority: 10 });
$store.keyboard.register("escape", clearSearch, { scope: "editor", priority: 1 });
```

## Escribir en un input

Por defecto un atajo no se dispara mientras el usuario escribe, que es lo que quieres para
casi todo. `allowInEditable` vuelve a habilitar un atajo dentro de un campo, para el caso
poco común de que una sola tecla tenga que funcionar también ahí.

```js
$store.keyboard.register("mod+k", openSearch, { allowInEditable: true });
```

## Referencia de la API

| Nombre                                               | Tipo   | Para qué sirve                                                                                                                                                             |
| ---------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$store.keyboard.commands`                           | store  | El registro, como un array de registros (`id`, `shortcut`, `scopes`, `priority`, `enabled`, …).                                                                            |
| `$store.keyboard.activeScopes`                       | store  | Los scopes encendidos ahora.                                                                                                                                               |
| `$store.keyboard.suspendedScopes`                    | store  | Los scopes suspendidos pero todavía recordados.                                                                                                                            |
| `$store.keyboard.register(chord, handler, options?)` | método | Agregar un atajo; devuelve una función de baja.                                                                                                                            |
| `$store.keyboard.unregister(id)`                     | método | Quitarlo por el `id` con el que se registró. Devuelve si existía.                                                                                                          |
| `$store.keyboard.activateScope(name)`                | método | Encender un scope.                                                                                                                                                         |
| `$store.keyboard.deactivateScope(name)`              | método | Apagar un scope.                                                                                                                                                           |
| `$store.keyboard.suspendScope(name)`                 | método | Apagar un scope, recordando que estaba encendido.                                                                                                                          |
| `$store.keyboard.resumeScope(name)`                  | método | Restaurar un scope suspendido.                                                                                                                                             |
| `$store.keyboard.isScopeActive(name)`                | método | Si un scope está encendido.                                                                                                                                                |
| `$store.keyboard.isScopeSuspended(name)`             | método | Si un scope está suspendido.                                                                                                                                               |
| `$store.keyboard.handleKeydown(event)`               | método | Matchear y correr contra un evento. El plugin ya escucha en `window`; llamalo para enrutar una tecla vos.                                                                  |
| `$store.keyboard.destroy()`                          | método | Teardown del host: saca el listener `keydown` de `window` y limpia todos los atajos registrados. Nada lo invoca automáticamente — lo llama el host que registró el plugin. |

Opciones de registro: `id`, `scope`, `priority`, `enabled`, `allowInEditable`,
`preventDefault`, `stopPropagation`, `metadata`, `when`.

:::caution[No vincules `handleKeydown` a un elemento esperando que se quede local]
El plugin monta el controller con un listener `keydown` en `window`, así que los atajos ya
disparan globalmente. Agregar `@keydown="$store.keyboard.handleKeydown($event)"` en un
componente corre el registro una segunda vez para el mismo evento — un atajo con
`preventDefault` dispara dos veces, y la segunda corrida ve el buffer que la primera ya
consumió. Enrutá teclas por `handleKeydown()` sólo cuando estés reemplazando el listener
global a propósito, por ejemplo en un test o un editor embebido.
:::

## Opciones del plugin

```ts
keyboardPlugin({ id: "app-keyboard", storeKey: "keys" });
```
