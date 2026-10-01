---
title: Command
---

@ailura/alpinejs-command

Una paleta de comandos: un input de búsqueda sobre una lista de acciones, con filtrado
rankeado, items fijados y recientes, y ejecución async. El plugin maneja la búsqueda, el
ranking y el ARIA del listbox; tú escribes los items y los comandos.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-command
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import commandPlugin from "@ailura/alpinejs-command";

Alpine.plugin(commandPlugin());

Alpine.start();
```

Eso registra un store `command`, así que todo lo de abajo vive en `$store.command`.

## Ejemplo mínimo

Un input, una lista filtrada, y dos comandos.

```html
<div
  x-data="{
    createFile() {
      console.log('create');
    },
    openFile() {
      console.log('open');
    },
  }"
  x-init="
    $store.command.register({ id: 'new-file', label: 'New file', action: () => createFile() });
    $store.command.register({ id: 'open-file', label: 'Open file', action: () => openFile() });
  "
  @keydown="$store.command.handleKeydown($event)"
>
  <button @click="$store.command.open()">Comandos</button>

  <template x-if="$store.command.isOpen">
    <div>
      <input x-bind="$store.command.inputProps()" x-model="$store.command.search" />

      <ul x-bind="$store.command.listboxProps()">
        <template x-for="state in $store.command.visibleItems" :key="state.id">
          <li x-bind="$store.command.optionProps(state.id)" @click="$store.command.run(state.id)">
            <span x-text="state.item.label"></span>
            <span x-show="state.loading">…</span>
          </li>
        </template>
      </ul>
    </div>
  </template>
</div>
```

`register` toma un solo `CommandItem` — `{ id, label, action }` más `group`, `shortcut`,
`keywords`, `aliases`, `pinned` y `page` opcionales — y devuelve la función que libera
esa registración. Guardá la función devuelta cuando necesites quitar el item después:

```js
const release = $store.command.register({ id: "new-file", label: "New file", action: create });
// después, en el teardown que tengas:
release();
```

`visibleItems` es una lista de _estados_ de item: `state.id` identifica la fila,
`state.item` es el `CommandItem` que registraste, y `state.disabled` / `state.loading` /
`state.pinned` / `state.recent` / `state.selectable` son los flags para renderizar.

`search` es una propiedad reactiva, no un método. Vinculala con `x-model` y el filtrado
y el ranking pasan mientras el usuario escribe. No hay un `setQuery()` que llamar.

`visibleItems` son los comandos filtrados y rankeados. Itera sobre eso en vez de sobre
`items`, o la paleta no filtra.

## Variantes

`rank` y los hooks de ciclo de vida son config del store, así que van en
`commandPlugin(...)`, no en un item. No existe ninguna opción `filter`.

**Puntúá los resultados tú.** Por defecto el ranking es el que trae el plugin; pasa una
función `rank` cuando "mejor coincidencia" significa algo específico para tu app.

```ts
commandPlugin({ rank: (item, search) => (item.label.startsWith(search) ? 10 : 1) });
```

**Filtra los items tú.** Un `rank` que devuelve `null` saca el item de la lista visible;
es lo único que filtra.

```ts
commandPlugin({
  rank: (item, search) =>
    item.keywords?.some((k) => k.includes(search)) ? 2 : item.label.includes(search) ? 1 : null,
});
```

:::note[No hay opción `filter`]
La config del store no tiene ningún miembro `filter`. Todo lo hace el ranking: devolvé
un número para puntuar una coincidencia, o `null` para sacar el item de la lista visible.
:::

**Haz un comando async.** `action` puede devolver una promesa. La paleta trackea el
comando en curso para que puedas mostrar un spinner en la fila correcta.

```js
$store.command.register({ id: "deploy", label: "Deploy", action: () => deploy() });
```

**Usa páginas para navegación anidada.** `pushPage` apila una página, `popPage` o
`goBack` la saca. `pageStack` reporta la profundidad. Los items pertenecen a una página
por su campo `page`; los que no tienen `page` (o `page: "root"`) viven en la raíz.

```js
$store.command.register({ id: "browse-project", label: "Browse project", action: browse });
await $store.command.pushPage({ id: "project", title: "Project" });
$store.command.goBack();
```

**Reacciona a la apertura.** Úsalo para enfocar el input.

```ts
commandPlugin({ onOpen: () => focusInput() });
```

## Referencia de la API

Consulta esto cuando la paleta ya funcione y necesites la firma exacta.

| Nombre                                           | Tipo     | Para qué sirve                                                                                                                                                                                                                                  |
| ------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$store.command.register(item)`                  | `method` | Agrega un `CommandItem` (`{ id, label, action, group?, shortcut?, keywords?, aliases?, pinned?, page?, ... }`). Lanza error si el id ya existe. **Devuelve la función de unregister** — llamala (o `unregister(item.id)`) para liberar el item. |
| `$store.command.unregister(itemId)`              | `method` | Quita un item registrado por id, también de las listas de pinned y recent.                                                                                                                                                                      |
| `$store.command.open()` / `close()` / `toggle()` | método   | Estado abierto.                                                                                                                                                                                                                                 |
| `$store.command.isOpen`                          | store    | Si está abierta.                                                                                                                                                                                                                                |
| `$store.command.search`                          | store    | La query. Escribible, así que `x-model` funciona: escribirla también vuelve `activeIndex` a 0.                                                                                                                                                  |
| `$store.command.visibleItems`                    | store    | Items filtrados y rankeados para renderizar.                                                                                                                                                                                                    |
| `$store.command.filteredItems` / `groupedItems`  | store    | Los mismos datos, con otra forma.                                                                                                                                                                                                               |
| `$store.command.items` / `pages`                 | store    | Items registrados y la pila de páginas.                                                                                                                                                                                                         |
| `$store.command.activeIndex`                     | store    | La fila resaltada.                                                                                                                                                                                                                              |
| `$store.command.runningId` / `loadingIds`        | store    | Qué comandos se están ejecutando.                                                                                                                                                                                                               |
| `$store.command.pinnedIds` / `recentIds`         | store    | Ids fijados y usados recientemente.                                                                                                                                                                                                             |
| `$store.command.pageStack` / `currentPageId`     | store    | Profundidad de páginas y la página actual.                                                                                                                                                                                                      |
| `$store.command.pushPage(page)`                  | método   | Apilar una página (`{ id, title, parentId?, load? }`), limpiar search y activeIndex, y esperar el `load()` de la página si tiene. Resuelve cuando la página está activa.                                                                        |
| `$store.command.popPage()` / `goBack()`          | método   | Sacar una página (no-op en la raíz) y limpiar search y activeIndex. `goBack()` es alias de `popPage()`.                                                                                                                                         |
| `$store.command.run(itemId)`                     | método   | Ejecutar un comando por id de item. Async-safe.                                                                                                                                                                                                 |
| `$store.command.cancelRun()`                     | método   | Limpiar todas las ejecuciones en vuelo y volver al estado idle. Las acciones pendientes igual terminan.                                                                                                                                         |
| `$store.command.itemState(id)`                   | método   | Estado por item: loading, pinned, recent.                                                                                                                                                                                                       |
| `$store.command.inputProps()`                    | método   | `role="combobox"` y los atributos aria del input.                                                                                                                                                                                               |
| `$store.command.listboxProps()`                  | método   | `role="listbox"`, `id="command-listbox"` y el título de la página actual como `aria-label`.                                                                                                                                                     |
| `$store.command.optionProps(itemId)`             | método   | `role="option"` y los atributos por fila.                                                                                                                                                                                                       |
| `$store.command.handleKeydown(event)`            | método   | Flechas, `Enter`, `Escape`. Necesario para el teclado.                                                                                                                                                                                          |

:::caution[Las flechas y `Enter` solo funcionan si vinculas `handleKeydown`]
La paleta abre, filtra y resalta perfecto con mouse, y las flechas no hacen nada.
`handleKeydown` es lo que mueve el índice activo y ejecuta el comando, y no hay señal
visual de que falte un handler.
:::

## Opciones del plugin

```ts
commandPlugin({ id: "app-command", storeKey: "paleta" });
```
