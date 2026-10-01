---
title: Carousel
---

@ailura/alpinejs-carousel

Un carousel sobre Embla: drag, autoplay, loop y el cableado ARIA de una región de slides.
El plugin maneja el índice y el motor; tú escribes el viewport, los slides y los
controles.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-carousel embla-carousel
```

El autoplay es un paquete aparte que el plugin importa bajo demanda, y no es un peer
declarado: instalalo vos si pasás `autoplay: true`.

```sh
pnpm add embla-carousel-autoplay
```

El import está envuelto en un `catch {}` pelado, así que un paquete faltante falla en
silencio: el carousel sigue funcionando, simplemente nunca avanza solo.

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import carouselPlugin from "@ailura/alpinejs-carousel";

Alpine.plugin(carouselPlugin());

Alpine.start();
```

Eso registra un store `carousel`, así que todo lo de abajo vive en `$store.carousel`.

## Ejemplo mínimo

Tres slides, con anterior y siguiente, y los roles de región y slide vinculados.

```html
<div
  x-data="{ id: 'galeria' }"
  x-init="$store.carousel.create(id, { loop: false, autoplay: false })"
  @keydown="$store.carousel.handleKeydown(id, $event)"
>
  <section x-bind="$store.carousel.carouselProps(id, { label: 'Galeria' })">
    <div x-bind="$store.carousel.viewportProps(id)" x-carousel="id">
      <template x-for="(slide, index) in ['Uno', 'Dos', 'Tres']" :key="slide">
        <div x-bind="$store.carousel.slideProps(id, index)">
          <span x-text="slide"></span>
        </div>
      </template>
    </div>
  </section>

  <button @click="$store.carousel.previous(id)" :disabled="!$store.carousel.canPrevious(id)">
    Anterior
  </button>
  <button @click="$store.carousel.next(id)" :disabled="!$store.carousel.canNext(id)">
    Siguiente
  </button>
</div>
```

Embla tiene que conocer el elemento del viewport antes de poder medir nada, así que el
store necesita una referencia al DOM. `x-carousel` es lo que se la pasa: su expresión es
el id de la instancia, y libera la vinculación cuando Alpine saca ese elemento del
árbol. El `$store.carousel.bindViewport(id, el)` escrito a mano sigue funcionando y es
lo que conviene usar cuando el elemento no es un nodo de template.

## Variantes

**Loop infinito.** Con `loop: false` los controles se desactivan en los bordes, que es el
default honesto para una galería finita.

```js
$store.carousel.create(id, { loop: true });
```

**Autoplay, y ajustalo.** `autoplay` es un booleano; el delay y el comportamiento de
stop-on-interaction de Embla van en `autoplayOptions`.

```js
$store.carousel.create(id, {
  autoplay: true,
  autoplayOptions: { delay: 4000, stopOnInteraction: true },
});
```

Hoy solo dos `autoplayOptions` llegan a Embla: `delay` (default `4000`) y
`stopOnInteraction` (default `true`). `stopOnMouseEnter`, `stopOnFocusIn` y
`stopWhenHidden` están declarados en el tipo y el compilador los acepta, pero el plugin
no los reenvía: ponerlos no cambia nada en runtime.

**Manejalo desde código.** `play()` y `goTo()` están para cuando el disparador no es un
botón sobre el slide. `play()` llama de verdad al plugin de autoplay de Embla; `pause()`
solo da vuelta el flag `isPlaying` y no llega al motor, así que el carousel sigue
avanzando solo después de que lo apretes.

```js
$store.carousel.play(id);
$store.carousel.goTo(id, 2);
```

**Reacciona a los cambios de slide.** `onChange` recibe el índice nuevo.

```js
$store.carousel.create(id, { onChange: (index) => track("slide", index) });
```

## Referencia de la API

| Nombre                                                     | Tipo     | Para qué sirve                                                                                                                                         |
| ---------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `$store.carousel.create(id, options?)`                     | `method` | Crear una instancia. Options: `loop`, `autoplay`, `autoplayOptions`, `axis`, `align`, `containScroll`, `dragFree`, `duration`, `ariaLive`, `onChange`. |
| `$store.carousel.destroy(id)`                              | `method` | Desarmar una instancia.                                                                                                                                |
| `$store.carousel.destroyAll()`                             | `method` | Desarmar todas las instancias.                                                                                                                         |
| `$store.carousel.next(id)` / `previous(id)`                | `method` | Moverse un slide.                                                                                                                                      |
| `$store.carousel.goTo(id, index)`                          | `method` | Saltar a un slide por índice.                                                                                                                          |
| `$store.carousel.current(id)`                              | `method` | El índice actual.                                                                                                                                      |
| `$store.carousel.count(id)`                                | `method` | Cuántos slides hay.                                                                                                                                    |
| `$store.carousel.canNext(id)` / `canPrevious(id)`          | `method` | Si es posible moverse; mueve el estado disabled.                                                                                                       |
| `$store.carousel.play(id)` / `pause(id)` / `isPlaying(id)` | método   | Control del autoplay. `play()` maneja el plugin de Embla; `pause()` solo da vuelta el flag `isPlaying`.                                                |
| `$store.carousel.bindViewport(id, el)`                     | `method` | Pasarle a Embla el elemento del viewport. Necesario antes de medir.                                                                                    |
| `$store.carousel.handleKeydown(id, event)`                 | `method` | Flechas. Necesario para el soporte de teclado.                                                                                                         |
| `$store.carousel.viewportProps(id, options?)`              | `method` | El viewport con scroll: `tabindex` y la custom property `--slide-size`. Pasá `{ slideSize: false }` para omitirla.                                     |
| `$store.carousel.slideProps(id, index)`                    | `method` | `role="group"`, `aria-roledescription`, `aria-label`, `aria-hidden` de un slide.                                                                       |
| `$store.carousel.indicatorProps(id, index)`                | `method` | `type`, `aria-label`, `aria-current` de un indicador de punto.                                                                                         |
| `$store.carousel.carouselProps(id, options?)`              | `method` | `role="region"`, `aria-roledescription`, `aria-live`, y el `aria-label` de `{ label }`. Vincularlo en el wrapper exterior.                             |
| `$store.carousel.instances`                                | store    | Registro reactivo de todas las instancias.                                                                                                             |

## Directivas

| Nombre            | Tipo        | Para qué sirve                                                                                                                    |
| ----------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `x-carousel="id"` | `directiva` | Vincula el elemento a la instancia cuyo id evalúa la expresión, y libera la vinculación cuando Alpine saca el elemento del árbol. |

La liberación es del elemento: el motor de Embla vinculado a ese viewport se destruye y
se suelta la referencia al elemento, mientras que la instancia sigue en
`$store.carousel.instances` para que sus controles la sigan manejando. Una expresión que
no sea un string no vincula nada. El nombre de la directiva se configura con
`directiveKey`.

:::caution[El `bindViewport` a mano sigue fallando en silencio]
Con `x-carousel` en el elemento no hay nada que olvidar. Si vinculás a mano, no se
lanza ninguna excepción cuando el viewport nunca se vincula: los slides renderizan, los
botones cambian el índice, y nada se mueve — lo que parece un problema de CSS y manda a
debuggear el archivo equivocado. Una vinculación manual tampoco se libera sola: solo la
toman `destroy(id)` o el cleanup de la directiva.
:::

## Opciones del plugin

```ts
carouselPlugin({ id: "app-carousel", storeKey: "galeria", directiveKey: "carousel" });
```
