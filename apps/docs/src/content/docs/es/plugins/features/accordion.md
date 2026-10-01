---
title: Accordion
---

@ailura/alpinejs-accordion

Una FAQ, un panel de ajustes, o cualquier lista donde una o varias secciones se expanden
y se contraen. El plugin maneja el estado de abierto/cerrado y el cableado ARIA; tú
escribes el markup y los estilos.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-accordion
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import accordionPlugin from "@ailura/alpinejs-accordion";

Alpine.plugin(accordionPlugin());

Alpine.start();
```

Eso registra un store `accordion`, así que todo lo de abajo vive en `$store.accordion`.

## Ejemplo mínimo

Un grupo, dos paneles, expansión única. Esta es la forma que necesita la mayoría de los
accordions.

```html
<div
  x-data="{ gid: 'faq' }"
  x-init="
    $store.accordion.register(gid, { mode: 'single' });
    $store.accordion.registerItem(gid, 'envios');
    $store.accordion.registerItem(gid, 'devoluciones');
  "
  @keydown="$store.accordion.handleKeydown(gid, $event)"
>
  <button
    x-bind="$store.accordion.triggerProps(gid, 'envios')"
    @click="$store.accordion.toggle(gid, 'envios')"
  >
    ¿Cómo envían?
  </button>
  <div
    x-bind="$store.accordion.panelProps(gid, 'envios')"
    x-show="$store.accordion.isOpen(gid, 'envios')"
  >
    En dos días hábiles.
  </div>

  <button
    x-bind="$store.accordion.triggerProps(gid, 'devoluciones')"
    @click="$store.accordion.toggle(gid, 'devoluciones')"
  >
    ¿Cuál es su política de devoluciones?
  </button>
  <div
    x-bind="$store.accordion.panelProps(gid, 'devoluciones')"
    x-show="$store.accordion.isOpen(gid, 'devoluciones')"
  >
    Treinta días, sin preguntas.
  </div>
</div>
```

Tres cosas hacen un trabajo que si no escribirías a mano:

- `triggerProps()` devuelve `aria-expanded`, `aria-controls`, un `id` y un `tabindex`
  rotatorio. Lo vinculas y tienes ARIA correcto gratis.
- `panelProps()` devuelve el `id`, `role="region"` y `aria-labelledby` al que apunta el
  trigger.
- `isOpen()` mueve el `x-show`, así el panel se oculta sin que toques el display.

:::caution[No quites la línea `@keydown`]
Las flechas, `Home` y `End` los maneja
`$store.accordion.handleKeydown(gid, $event)`. Sin ella, `triggerProps` deja todos los
triggers en `tabindex="-1"` y el grupo queda inalcanzable por teclado — y sigue
funcionando con mouse, que es justo lo que deja pasar el bug.
:::

## Variantes

**Deja varios paneles abiertos a la vez.** Usa `multiple` cuando los paneles son
preguntas independientes, no un wizard. En modo `single`, abrir uno cierra los demás.

```js
$store.accordion.register(gid, { mode: "multiple" });
```

**Arranca con un panel ya abierto.** `defaultOpen` toma un id, o una lista de ids. En
modo `single` solo se usa el primero.

```js
$store.accordion.register(gid, { mode: "multiple", defaultOpen: ["envios"] });
```

**Mantén una sección bloqueada.** Un item deshabilitado no abre, y las flechas lo saltan.
Útil para una sección que se desbloquea cuando se cumple una condición.

```js
$store.accordion.registerItem(gid, "reembolsos", true);
```

**Reacciona a los cambios.** `onChange` recibe los ids abiertos cada vez que cambia la
selección, para que puedas persistirlo o sincronizarlo en otro lado.

```js
$store.accordion.register(gid, {
  mode: "single",
  onChange: (openIds) => localStorage.setItem("faq", JSON.stringify(openIds)),
});
```

## Referencia de la API

Consulta esto cuando el componente ya funcione y necesites la firma exacta.

| Nombre                                                          | Tipo     | Para qué sirve                                                                       |
| --------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `$store.accordion.register(id, options?)`                       | `method` | Crear un grupo. Options: `mode` (`single` \| `multiple`), `defaultOpen`, `onChange`. |
| `$store.accordion.unregister(id)`                               | `method` | Quitar un grupo y sus items.                                                         |
| `$store.accordion.registerItem(id, itemId, disabled?)`          | `method` | Agregar un panel. Pasa `true` para bloquearlo.                                       |
| `$store.accordion.unregisterItem(id, itemId)`                   | `method` | Quitar un panel.                                                                     |
| `$store.accordion.open(id, itemId)`                             | `method` | Abrir un panel.                                                                      |
| `$store.accordion.close(id, itemId)`                            | `method` | Cerrar un panel.                                                                     |
| `$store.accordion.toggle(id, itemId)`                           | `method` | Alternar un panel. El handler de click habitual.                                     |
| `$store.accordion.isOpen(id, itemId)`                           | `method` | Si un panel está abierto. Mueve el `x-show`.                                         |
| `$store.accordion.openIds(id)`                                  | `method` | Los ids de los paneles abiertos.                                                     |
| `$store.accordion.handleKeydown(id, event)`                     | `method` | Flechas, `Home`, `End`. Necesario para el soporte de teclado.                        |
| `$store.accordion.activeItem(id)` / `setActiveItem(id, itemId)` | `method` | El objetivo del tabindex rotatorio. `handleKeydown` lo mantiene por tú.              |
| `$store.accordion.triggerProps(id, itemId)`                     | `method` | `aria-expanded`, `aria-controls`, `id`, `tabindex` de un trigger.                    |
| `$store.accordion.panelProps(id, itemId)`                       | `method` | `id`, `role="region"`, `aria-labelledby`, `aria-hidden` de un panel.                 |
| `$store.accordion.groups`                                       | `store`  | Registro reactivo de todos los grupos.                                               |

## Opciones del plugin

`accordionPlugin()` acepta options solo si ya posees el nombre del store `accordion`.

```ts
accordionPlugin({ id: "faq-accordion", storeKey: "faq" });
```
