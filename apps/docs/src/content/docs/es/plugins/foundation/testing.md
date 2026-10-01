---
title: Testing
---

@ailura/alpinejs-testing

Helpers para testear plugins de Alpine en Node con `happy-dom`. No hay browser ni magic
de Alpine que aprender: `start()` arranca Alpine una vez, `html` + `mount` ponen un
snippet en la página, `settled()` espera a que la reactividad llegue al DOM, y `reset()`
desarma todo.

**Solo para desarrollo.** Nada de esto debería importarse desde código de runtime, y este
paquete nunca se publica a `dist`.

## Instalar

```sh
pnpm install   # dentro del monorepo; resuelve @ailura/alpinejs-testing como devDependency
```

Este paquete es `private`: es una devDependency del workspace, no un paquete del registro,
así que se resuelve desde el monorepo y no desde un comando de install.

## La forma de cuatro líneas

Todo test de plugin tiene la misma forma.

```ts
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { html, mount, settled, start, resume, reset } from "@ailura/alpinejs-testing";
import { accordionPlugin } from "../src/plugin";

beforeAll(() => start(accordionPlugin()));
beforeEach(() => resume());
afterEach(() => reset());

it("abre al hacer click", async () => {
  mount(html("<div x-data><button x-accordion:trigger>abrir</button></div>"));
  await settled();
  expect(document.querySelector("button")).toBeTruthy();
});
```

- `start(plugin)` registra el plugin y llama `Alpine.start()`. **Una vez por archivo**:
  Alpine es global, así que un segundo `start()` en el mismo archivo es un registro
  duplicado.
- `resume()` vuelve a activar la observación de mutaciones. Alpine deja de observar
  después de un `reset()`, y por eso el segundo test del archivo no hace nada.
- `reset()` desarma el DOM y corre los hooks registrados con `onReset`.
- `settled()` espera dos ticks de Alpine (`nextTick`), que es lo que la reactividad necesita
  para llegar al DOM. Un `await Promise.resolve()` a secas no alcanza y falla de forma
  intermitente.

## `html()` y `mount()` están separados a propósito

`html()` construye un elemento desconectado. `mount(el)` lo mueve a `document.body` para
que Alpine lo inicialice. El nodo se mueve, no se clona, así que `reset()` lo puede
remover y una referencia que guardaste sigue apuntando al elemento vivo.

```ts
const el = html("<div x-data></div>");
mount(el);
expect(el.isConnected).toBe(true);
```

## Resetear el estado de las guardas entre archivos

Las guardas de registro de [Core](/es/plugins/foundation/core/) recuerdan qué nombres
reclamó cada paquete. Sin un hook de reset, un segundo archivo de test que registre el
mismo nombre de store falla con un `RegistrationError` que no tiene nada que ver con el
test.

```ts
// test/setup.ts
import { onReset } from "@ailura/alpinejs-testing";
import { resetRegistrationTracking } from "@ailura/alpinejs-core/guards";

onReset(resetRegistrationTracking);
```

## Referencia de la API

| Nombre          | Tipo    | Para qué sirve                                                         |
| --------------- | ------- | ---------------------------------------------------------------------- |
| `html(snippet)` | función | Construye un elemento desligado a partir de un string HTML.            |
| `mount(el)`     | función | Lo agrega a `document.body`. No devuelve nada.                         |
| `settled()`     | async   | Espera a que la reactividad llegue al DOM. Dos ticks de Alpine.        |
| `start(plugin)` | función | Registra el plugin y llama a `Alpine.start()`. Una vez por archivo.    |
| `resume()`      | función | Reinicia la observación de mutaciones después de un `reset()`.         |
| `reset()`       | función | Deja de observar, destruye el árbol, limpia el body y corre los hooks. |
| `onReset(fn)`   | función | Registra un hook que corre `reset()`; devuelve un unsubscribe.         |

:::caution[Un archivo sin `resume()` falla en el segundo test]
`reset()` detiene el observer de mutaciones de Alpine, así que cualquier cosa montada
después queda inerte. El primer test pasa, el segundo encuentra un DOM plausible pero
desconectado, y el fallo apunta a tu componente en vez de al `beforeEach` que falta.
:::
