---
title: Child
---

@ailura/alpinejs-child

Una sola directiva, `x-child`, que mueve los atributos propios del elemento hacia su
primer hijo. Existe para que un wrapper pueda cargar las clases y el ARIA que necesita
un componente de terceros, sin que tú filtres ese markup hacia adentro del componente.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-child
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import childPlugin from "@ailura/alpinejs-child";

Alpine.plugin(childPlugin());

Alpine.start();
```

Eso registra la directiva `x-child`. No hay store ni magic.

## Ejemplo mínimo

Un wrapper que dona sus atributos al botón que lleva adentro.

```html
<div x-child class="btn btn-primary" aria-label="Guardar cambios" data-testid="save">
  <button>Guardar</button>
</div>
```

`class`, `aria-label` y `data-testid` quedan en el `<button>`, y el wrapper no renderiza
nada. El componente conserva su markup; tú conservas el estilo y el nombre accesible.

Esta es la idea de `asChild` de las librerías de React, como atributo.

## Cuando el primer hijo no es el elemento que quieres

Solo el **primer** elemento hijo recibe los atributos, y un nodo de texto o un comentario
antes no cuenta. Con un primer hijo anidado, la donación cae un nivel más profundo, así
que mantené el objetivo como el primer elemento directo.

```html
<!-- va al span -->
<div x-child class="badge"><span>Nuevo</span></div>
```

:::caution[Los atributos se mueven, no se copian]
`x-child` los transfiere. El wrapper no se queda con nada, así que no puedes estilizar el
wrapper y el hijo con la misma regla, y lo que también quieras en el wrapper hay que
escribirlo en un elemento padre.
:::

## Referencia de la API

| Directiva         | Tipo        | Para qué sirve                                                                                           |
| ----------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| `x-child`         | `directiva` | Mueve los atributos propios del elemento hacia su primer elemento hijo.                                  |
| `x-child.merge`   | `directiva` | Igual, pero combinando el `class`: se conservan los tokens del hijo y se agregan los únicos del wrapper. |
| `x-child.replace` | `directiva` | Igual, pero tomando el `class` solo del wrapper; todo otro atributo le gana al hijo.                     |

`x-child` no recibe valor. `x-child.merge` y `x-child.replace` son la misma directiva con
un sufijo de modo — `.merge` es el comportamiento por defecto escrito explícitamente,
`.replace` hace que gane el wrapper.
