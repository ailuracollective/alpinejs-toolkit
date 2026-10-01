---
title: Dialog
---

@ailura/alpinejs-dialog

Un diálogo modal. El plugin maneja el estado abierto, la tecla Escape y el click fuera;
tú escribes el markup y te aseguras de que el foco quede adentro.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-dialog
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import dialogPlugin from "@ailura/alpinejs-dialog";

Alpine.plugin(dialogPlugin());

Alpine.start();
```

Eso registra un store `dialog`, así que todo lo de abajo vive en `$store.dialog`.

## Ejemplo mínimo

Un diálogo de confirmación que cierra con Escape, con click fuera y con sus propios
botones.

```html
<div
  x-data="{ id: 'borrar-proyecto' }"
  x-init="$store.dialog.register(id)"
  @keydown.window="$store.dialog.handleKeydown(id, $event)"
>
  <button @click="$store.dialog.open(id)">Borrar proyecto</button>

  <template x-if="$store.dialog.isOpen(id)">
    <div class="backdrop" @click="$store.dialog.handleOutsideClick(id, $event)">
      <div
        x-bind="$store.dialog.dialogProps(id)"
        class="panel"
        x-init="$store.dialog.bindContainer(id, $el)"
        @click.stop
      >
        <h2 id="borrar-proyecto-label">¿Borrar este proyecto?</h2>
        <p>Esto no se puede deshacer.</p>
        <button @click="$store.dialog.close(id)">Cancelar</button>
        <button @click="$store.dialog.close(id)">Borrar</button>
      </div>
    </div>
  </template>
</div>
```

`dialogProps()` devuelve `role="dialog"`, `aria-modal`, y el `aria-labelledby` /
`aria-describedby` que pasaste a `register()`. Pon los ids en `register()` y el markup
se mantiene declarativo:

```js
$store.dialog.register(id, { labelledBy: "borrar-proyecto-label" });
```

`template x-if` en vez de `x-show` es a propósito: un diálogo cerrado no debería estar
en el DOM, o la página de atrás sigue siendo alcanzable para un lector de pantalla. El
`x-init` del panel tampoco es opcional: el cierre por click fuera solo dispara mientras
`bindContainer` le haya dicho al store cuál es el elemento del diálogo.

## Variantes

**Deja el diálogo abierto cuando el usuario hace click afuera.** Algunas confirmaciones
deben exigir una elección explícita. Apaga los dos defaults para un flujo deliberado.

```js
$store.dialog.register(id, { closeOnEscape: false, closeOnOutsideClick: false });
```

**Abre con el contenido ya cargado.** `open()` toma un objeto de options, así que puedes
meter datos del servidor sin una segunda vuelta por el estado de Alpine.

```js
$store.dialog.open(id, { labelledBy: "borrar-proyecto-label", describedBy: "texto-aviso" });
```

**挂钩 las transiciones de apertura y cierre.** Usalos para manejo de foco, analítica, o
avisos de cambios sin guardar. Son options de `register()`, no métodos, así que disparan
una vez por transición en vez de en cada render.

```js
$store.dialog.register(id, {
  onOpen: () => console.log("abierto"),
  onClose: () => console.log("cerrado"),
});
```

## Referencia de la API

Consulta esto cuando el diálogo ya funcione y necesites la firma exacta.

| Nombre                                        | Tipo     | Para qué sirve                                                                                     |
| --------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `$store.dialog.register(id, options?)`        | `method` | Crear una instancia. Options: `labelledBy`, `describedBy`, `closeOnEscape`, `closeOnOutsideClick`. |
| `$store.dialog.unregister(id)`                | `method` | Quitar una instancia.                                                                              |
| `$store.dialog.open(id, options?)`            | `method` | Abrirlo, actualizando opcionalmente `labelledBy` / `describedBy`.                                  |
| `$store.dialog.close(id)`                     | `method` | Cerrarlo.                                                                                          |
| `$store.dialog.toggle(id, options?)`          | `method` | Abrir si está cerrado, cerrar si está abierto.                                                     |
| `$store.dialog.isOpen(id)`                    | `method` | Si está abierto. Mueve el `template x-if`.                                                         |
| `$store.dialog.handleKeydown(id, event)`      | `method` | Escape. Necesario para el cierre con Escape.                                                       |
| `$store.dialog.bindContainer(id, elemento)`   | `method` | Decirle al store cuál es el elemento del diálogo. Necesario para cerrar con click fuera.           |
| `$store.dialog.handleOutsideClick(id, event)` | `method` | Click en el backdrop. Necesario para cerrar con click fuera.                                       |
| `$store.dialog.dialogProps(id)`               | `method` | `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`.                              |
| `$store.dialog.instances`                     | `store`  | Registro reactivo de todas las instancias.                                                         |

:::caution[El soporte de teclado necesita dos handlers, y el click fuera necesita un tercero]
El cierre con Escape lo maneja `handleKeydown`, y el click fuera
`handleOutsideClick` — que no hace nada hasta que `bindContainer` registró el elemento
del diálogo. Si vinculas solo el primero, el diálogo cierra con Escape pero el click en
el backdrop no hace nada. Los tres están en el ejemplo de arriba, sobre elementos
distintos, que es por qué es fácil unirlos por error.
:::

## Opciones del plugin

`dialogPlugin()` acepta options solo si ya posees el nombre del store `dialog`, o si
querés cambiar los defaults que hereda cada instancia.

```ts
dialogPlugin({ id: "app-dialog", storeKey: "modal", closeOnEscape: true });
```
