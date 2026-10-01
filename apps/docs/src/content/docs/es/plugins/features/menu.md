---
title: Menu
---

@ailura/alpinejs-menu

Un menú desplegable o contextual. El plugin maneja el estado abierto, el tabindex
rotatorio, la navegación con flechas y el cierre al hacer click afuera; tú escribes el
markup.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-menu
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import menuPlugin from "@ailura/alpinejs-menu";

Alpine.plugin(menuPlugin());

Alpine.start();
```

Eso registra un store `menu`, así que todo lo de abajo vive en `$store.menu`.

## Ejemplo mínimo

Una fila de acciones detrás de un botón disparador.

```html
<div
  x-data="{ id: 'acciones-fila' }"
  x-init="
    $store.menu.register(id);
    $store.menu.registerItem(id, 'renombrar');
    $store.menu.registerItem(id, 'duplicar');
    $store.menu.registerItem(id, 'borrar');
  "
  @keydown="$store.menu.handleKeydown(id, $event)"
  @click.outside="$store.menu.close(id)"
>
  <button
    @click="$store.menu.toggle(id)"
    :aria-expanded="$store.menu.isOpen(id)"
    aria-haspopup="menu"
  >
    Acciones
  </button>

  <div
    x-bind="$store.menu.menuProps(id)"
    x-bind:aria-hidden="$store.menu.menuHidden(id)"
    x-show="$store.menu.isOpen(id)"
  >
    <template x-for="item in ['renombrar', 'duplicar', 'borrar']" :key="item">
      <button
        x-bind="$store.menu.itemProps(id, item)"
        x-bind:tabindex="$store.menu.itemTabIndex(id, item)"
        x-bind:aria-disabled="$store.menu.itemDisabled(id, item)"
        @click="$store.menu.selectItem(id, item)"
      >
        <span
          x-text="item === 'renombrar' ? 'Renombrar' : item === 'duplicar' ? 'Duplicar' : 'Borrar'"
        ></span>
      </button>
    </template>
  </div>
</div>
```

`itemProps()` devuelve `role="menuitem"` y un `id` estable. `menuProps()` devuelve
`role="menu"`, el `id` correspondiente y `aria-orientation`.

:::caution[Lo que cambia necesita su propio `x-bind:`, no la forma de objeto]
Alpine aplica un `x-bind="$store.menu.menuProps(id)"` de forma de objeto exactamente
una vez, al inicializar el elemento. No es un efecto, así que nada de lo que devuelve el
objeto se vuelve a evaluar. Por eso cada atributo que tiene que seguir al estado —
`aria-hidden`, el `tabindex` rotatorio, `aria-disabled`— es un accessor aparte ligado con
la forma por atributo, que sí se reevalúa.

Equivocarse aquí es silencioso, no ruidoso. Con el `tabindex` congelado dentro del
objeto, todos los items se quedaban en `tabindex="-1"` y el menú no se podía alcanzar
con el teclado; con el `aria-hidden` congelado en `true`, el navegador se negaba a
ocultar el menú y avisaba de que el foco había quedado dentro. Si un valor que debería
cambiar nunca cambia, comprueba si va dentro del objeto.
:::

`close()` devuelve el foco al trigger, así que un menú cerrado con <kbd>Escape</kbd> o al
elegir un item no deja el teclado atrapado en un subárbol oculto. Busca un elemento
enfocable dentro de lo que se le pasó a `bindTrigger()`, así que pasar un `<div>`
envolvente alrededor del botón funciona igual.

## Variantes

**Mantené el menú abierto después de elegir.** El default cierra al seleccionar, que es
lo correcto para comandos. Apagalo para un menú de toggles.

```js
$store.menu.register(id, { closeOnSelect: false });
```

**Que las flechas sigan el layout.** Pon `orientation` en `vertical` y arriba/abajo
navegan; dejalo horizontal y izquierda/derecha lo hacen.

```js
$store.menu.register(id, { orientation: "vertical" });
```

**Agrupá items bajo un padre.** `parentId` registra que un item pertenece a un grupo,
para que tu propio markup lo anide o lo filtre. Las flechas recorren la lista plana de
items, así que entrar a un submenú sigue siendo código tuyo.

```js
$store.menu.registerItem(id, "exportar-pdf", { parentId: "exportar" });
```

**Bloquea un item.** Un item deshabilitado es saltado por las flechas y reporta
`aria-disabled`.

```js
$store.menu.registerItem(id, "borrar", { disabled: true });
```

**Reacciona a las selecciones.** `onSelect` dispara con el id del item, que es donde
encajas el comando.

```js
$store.menu.register(id, { onSelect: (itemId) => run(itemId) });
```

## Referencia de la API

Consulta esto cuando el menú ya funcione y necesites la firma exacta.

| Nombre                                              | Tipo     | Para qué sirve                                                                                 |
| --------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `$store.menu.register(id, options?)`                | `method` | Crear una instancia. Options: `orientation`, `closeOnSelect`, `onOpen`, `onClose`, `onSelect`. |
| `$store.menu.unregister(id)`                        | `method` | Quitar una instancia.                                                                          |
| `$store.menu.registerItem(id, itemId, options?)`    | `method` | Agregar un item. Options: `disabled`, `parentId`.                                              |
| `$store.menu.unregisterItem(id, itemId)`            | `method` | Quitar un item.                                                                                |
| `$store.menu.open(id)` / `close(id)` / `toggle(id)` | `method` | Cambiar el estado abierto.                                                                     |
| `$store.menu.isOpen(id)`                            | `method` | Si está abierto.                                                                               |
| `$store.menu.selectItem(id, itemId)`                | `method` | Activar un item, disparando `onSelect`.                                                        |
| `$store.menu.handleKeydown(id, event)`              | `method` | Flechas, `Home`, `End`, `Enter`, `Espacio`. Necesario para teclado.                            |
| `$store.menu.handleOutsideClick(id, event)`         | `method` | Click fuera del menú.                                                                          |
| `$store.menu.itemProps(id, itemId)`                 | `method` | `role="menuitem"`, `id`. Estáticos: enlázalos por atributo, no como objeto.                    |
| `$store.menu.itemTabIndex(id, itemId)`              | `method` | `0` para el item activo, `-1` para el resto. Para `x-bind:tabindex`.                           |
| `$store.menu.itemDisabled(id, itemId)`              | `method` | Si un item está bloqueado. Para `x-bind:aria-disabled`.                                        |
| `$store.menu.menuProps(id)`                         | `method` | `role="menu"`, `id`, `aria-orientation`. Estáticos.                                            |
| `$store.menu.menuHidden(id)`                        | `method` | `true` mientras está cerrado. Para `x-bind:aria-hidden`.                                       |
| `$store.menu.instances`                             | `store`  | Registro reactivo de todas las instancias.                                                     |

:::caution[Dos handlers, y es fácil unirlos por error]
Las flechas y `Enter` vienen de `handleKeydown`, el cierre del `onClick.outside` en el
markup. Vincula solo el primero y el menú atrapa el foco del teclado en un menú que el
usuario no puede cerrar. El ejemplo de arriba conecta los dos a propósito;
`handleOutsideClick` es la alternativa a nivel de store para los hosts que prefieran no
usar la directiva.
:::

## Opciones del plugin

`menuPlugin()` acepta options solo si ya posees el nombre del store `menu`, si
necesitás el magic bajo otra clave, o si querés más de un menú abierto a la vez
(`exclusive` viene en `true`).

```ts
menuPlugin({ id: "app-menu", storeKey: "appMenu", exclusive: false });
```
