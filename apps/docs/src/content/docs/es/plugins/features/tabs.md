---
title: Tabs
---

@ailura/alpinejs-tabs

Una tira de tabs que cambia entre paneles. El plugin maneja el tab activo, el cableado
ARIA y la navegación con flechas; tú escribes el markup.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-tabs
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import tabsPlugin from "@ailura/alpinejs-tabs";

Alpine.plugin(tabsPlugin());

Alpine.start();
```

Eso registra un store `tabs`, así que todo lo de abajo vive en `$store.tabs`.

## Ejemplo mínimo

Dos tabs, horizontales, con los dos paneles en el DOM y solo el activo visible.

```html
<div
  x-data="{ gid: 'ajustes' }"
  x-init="
    $store.tabs.register(gid, { orientation: 'horizontal' });
    $store.tabs.registerTab(gid, 'perfil');
    $store.tabs.registerTab(gid, 'facturacion');
  "
  @keydown="$store.tabs.handleKeydown(gid, $event)"
>
  <div x-bind="$store.tabs.tablistProps(gid)">
    <button x-bind="$store.tabs.tabProps(gid, 'perfil')" @click="$store.tabs.select(gid, 'perfil')">
      Perfil
    </button>
    <button
      x-bind="$store.tabs.tabProps(gid, 'facturacion')"
      @click="$store.tabs.select(gid, 'facturacion')"
    >
      Facturación
    </button>
  </div>

  <div x-bind="$store.tabs.panelProps(gid, 'perfil')">Tu nombre, email, avatar.</div>
  <div x-bind="$store.tabs.panelProps(gid, 'facturacion')">Tarjeta, facturas, plan.</div>
</div>
```

Tres cosas hacen un trabajo que si no escribirías a mano:

- `tabProps()` devuelve `role="tab"`, un `id`, `aria-selected`, `aria-controls` y un
  `tabindex` rotatorio.
- `panelProps()` devuelve `role="tabpanel"`, el `id` al que apunta el tab, y `hidden`.
  Úsalo en vez de `x-show` para que el panel quede bien oculto para tecnología asistiva.
- `tablistProps()` devuelve `role="tablist"` más el `aria-orientation` que registraste.

:::caution[No quites la línea `@keydown`]
Las flechas izquierda y derecha, arriba y abajo, `Home` y `End` los maneja
`$store.tabs.handleKeydown(gid, $event)`. Sin ella, `tabProps` deja todos los tabs en
`tabindex="-1"` y la tira queda inalcanzable por teclado — mientras sigue funcionando
perfecto con mouse, que es lo que deja pasar el bug.
:::

## Variantes

**Que las flechas sigan el layout visual.** Pon `orientation` cuando los tabs se apilan
verticalmente; las direcciones de las flechas se invierten con eso.

```js
$store.tabs.register(gid, { orientation: "vertical" });
```

**Abre un tab específico al cargar.** `defaultTab` elige el tab inicial.

```js
$store.tabs.register(gid, { defaultTab: "facturacion" });
```

**Bloquea un tab.** Un tab deshabilitado es saltado por las flechas y no se puede
seleccionar.

```js
$store.tabs.registerTab(gid, "facturacion", true);
```

**Reacciona a los cambios.** `onChange` recibe el nuevo id de tab.

```js
$store.tabs.register(gid, { onChange: (tabId) => console.log("ahora en", tabId) });
```

## Referencia de la API

Consulta esto cuando los tabs ya funcionen y necesites la firma exacta.

| Nombre                                          | Tipo     | Para qué sirve                                                      |
| ----------------------------------------------- | -------- | ------------------------------------------------------------------- |
| `$store.tabs.register(id, options?)`            | `method` | Crear un grupo. Options: `orientation`, `defaultTab`, `onChange`.   |
| `$store.tabs.unregister(id)`                    | `method` | Quitar un grupo y sus tabs.                                         |
| `$store.tabs.registerTab(id, tabId, disabled?)` | `method` | Agregar un tab. Pasa `true` para bloquearlo.                        |
| `$store.tabs.unregisterTab(id, tabId)`          | `method` | Quitar un tab.                                                      |
| `$store.tabs.select(id, tabId)`                 | `method` | Activar un tab.                                                     |
| `$store.tabs.active(id)`                        | `method` | El id del tab activo, o `null`.                                     |
| `$store.tabs.isActive(id, tabId)`               | `method` | Si un tab está activo.                                              |
| `$store.tabs.handleKeydown(id, event)`          | `method` | Flechas, `Home`, `End`. Necesario para el soporte de teclado.       |
| `$store.tabs.next(id)` / `previous(id)`         | `method` | Mueven la selección un tab habilitado adelante o atrás, con wrap.   |
| `$store.tabs.tablistProps(id)`                  | `method` | `role="tablist"` y `aria-orientation`. Vincularlo en el contenedor. |
| `$store.tabs.tabProps(id, tabId)`               | `method` | `role="tab"`, `id`, `aria-selected`, `aria-controls`, `tabindex`.   |
| `$store.tabs.panelProps(id, tabId)`             | `method` | `role="tabpanel"`, `id`, `aria-labelledby`, `hidden`.               |
| `$store.tabs.groups`                            | `store`  | Registro reactivo de todos los grupos.                              |
| `$store.tabs.destroy()`                         | `method` | Destruye el controlador.                                            |

## Opciones del plugin

`tabsPlugin()` acepta options solo si ya posees el nombre del store `tabs`, o si
necesitas el magic bajo otra clave.

```ts
tabsPlugin({ id: "ajustes-tabs", storeKey: "ajustesTabs" });
```
