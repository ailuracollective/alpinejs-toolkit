---
title: UI
---

@ailura/alpinejs-ui

Los helpers de browser que comparten los paquetes de features: adaptadores de storage,
una raíz de portal y un listener de media query. UI **no** es un plugin de Alpine — no
registra nada y no hay store. Importas lo que necesites y lo compones tú.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-core @ailura/alpinejs-ui
```

Core es un peer: las guardas de SSR que leen los helpers viven ahí, no en UI.

## Adaptadores de storage

Un adaptador es `{ get, set, remove, subscribe }`. El de memoria sirve para tests y para estado
que no debe sobrevivir a la recarga; el de localStorage persiste y se sincroniza entre
pestañas. `get()` devuelve `null` cuando no hay nada válido guardado, y `remove()` borra
la entrada.

```ts
import { createMemoryAdapter, createLocalStorageAdapter } from "@ailura/alpinejs-ui/storage";

// Tests, o estado que se reinicia al recargar.
const draft = createMemoryAdapter<string>({ initial: "" });

// Persistido, y sincronizado con las otras pestañas.
const theme = createLocalStorageAdapter<string>({
  key: "app-theme",
  parse: JSON.parse,
  serialize: JSON.stringify,
});
```

`createLocalStorageAdapter` necesita `parse` y `serialize` porque los valores vuelven
como strings. Un `SecurityError` de un storage bloqueado se maneja degradando en
silencio, así que un browser con el storage deshabilitado no tira abajo la página.

`subscribe()` en el adaptador local conecta el evento `storage` entre pestañas, que es lo
que hace que un cambio en una llegue a las otras. Pasa `crossTab: false` para desactivarlo.

## Una raíz de portal

Los overlays necesitan un contenedor que no esté dentro de un contexto de recorte o de
apilamiento. `createPortalRoot` lo devuelve, creándolo si hace falta y reutilizándolo
después.

```ts
import { createPortalRoot } from "@ailura/alpinejs-ui/portal";

const root = createPortalRoot();
const portal = createPortalRoot({ id: "dialog-root", className: "z-50" });
```

`removePortalRoot(el)` desconecta un contenedor que ya tenés. Toma el elemento, no el id,
así que nunca puede tirar abajo una raíz que creó otro consumidor con el mismo id.

Devuelve `null` fuera del browser, así que es seguro llamarlo durante SSR.

## Un listener de media query

`createMediaQueryListener` te da los eventos de cambio de una query y te devuelve la
función para desuscribirte.

```ts
import { createMediaQueryListener } from "@ailura/alpinejs-ui/media";

const stop = createMediaQueryListener("(prefers-reduced-motion: reduce)", (event) => {
  if (event.matches) pauseAnimations();
});

stop();
```

La función devuelta es un no-op cuando el browser no tiene `matchMedia`, así que llamar
`stop()` sin condiciones es seguro.

:::caution[Un listener que nunca se detiene sobrevive a su componente]
`createMediaQueryListener` devuelve un unsubscribe y nadie lo llama por tú. Un listener
que sigue vivo por un componente ya desmontado mantiene alcanzable todo el closure del
callback, que es una fuga que crece con cada navegación.
:::

## Exports por subpath

| Subpath     | Aporta                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------- |
| `.`         | Todo, re-exportado.                                                                                                  |
| `./storage` | `createMemoryAdapter`, `createLocalStorageAdapter`, los tipos de adaptador.                                          |
| `./portal`  | `createPortalRoot`, `removePortalRoot`, `PortalRootOptions`.                                                         |
| `./media`   | `createMediaQueryListener`.                                                                                          |
| `./types`   | `StorageAdapter`, `SubscribableStorageAdapter`, `Unsubscribe`, `LocalStorageAdapterOptions`, `MemoryAdapterOptions`. |
