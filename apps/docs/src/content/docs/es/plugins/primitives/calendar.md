---
title: Calendar
---

@ailura/alpinejs-calendar

Un calendario headless: el mes actual, la selección y la navegación. No renderiza nada,
así que la grilla, el encabezado de semana y los estilos siguen siendo tuyos.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-calendar
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import calendarPlugin from "@ailura/alpinejs-calendar";

Alpine.plugin(calendarPlugin());

Alpine.start();
```

Eso registra un store `calendar`, así que todo lo de abajo vive en `$store.calendar`.

## Ejemplo mínimo

Navegar meses, saltar a hoy y seleccionar una fecha.

```html
<div x-data>
  <p>
    <button @click="$store.calendar.prevMonth()">Anterior</button>
    <span x-text="$store.calendar.month.toISOString().slice(0, 7)"></span>
    <button @click="$store.calendar.nextMonth()">Siguiente</button>
    <button @click="$store.calendar.goToToday()">Hoy</button>
  </p>

  <p>
    Seleccionada:
    <span x-text="$store.calendar.selected ?? 'ninguna'"></span>
    <button @click="$store.calendar.select(new Date())">Seleccionar hoy</button>
    <button @click="$store.calendar.clear()">Limpiar</button>
  </p>
</div>
```

`month` es un `Date`, no un string, y `selected` es lo que permita tu modo. El plugin
maneja la navegación y los límites; calcular las semanas y renderizar la grilla es
código tuyo.

## Acotar el rango

`minDate` y `maxDate` van a la factory del plugin, no a un método. **No** existe un
`configure()` en el store: el rango se fija cuando se crea el plugin.

```ts
calendarPlugin({
  minDate: new Date("2026-01-01"),
  maxDate: new Date("2026-12-31"),
});
```

El store rechaza en silencio una fecha fuera del rango. Los límites tampoco se leen del
store, así que guarda las dos fechas que pasaste en tu propio módulo y compara contra
esas — si no, el último día del mes parece roto y nadie sabe por qué.

```html
<button
  @click="
    if (day >= bounds.min && day <= bounds.max)
      $store.calendar.select(day)
  "
  :disabled="day < bounds.min || day > bounds.max"
>
  <span x-text="day.getDate()"></span>
</button>
```

## Variantes

**Elegir un modo.** `mode` decide si `selected` es una fecha o varias. Se lee del store y
se setea en la factory.

```ts
calendarPlugin({ mode: "range" });
```

El modo se lee del store, que es a lo que se vincula la UI.

```html
<p>Modo: <span x-text="$store.calendar.mode"></span></p>
```

**Saltar a un mes.** `goToMonth` toma cualquier fecha; lo que importa es el mes.

```js
$store.calendar.goToMonth(new Date("2027-03-15"));
```

## Referencia de la API

| Nombre                             | Tipo   | Para qué sirve                                    |
| ---------------------------------- | ------ | ------------------------------------------------- |
| `$store.calendar.month`            | store  | El mes que se muestra, como `Date`.               |
| `$store.calendar.selected`         | store  | La selección actual.                              |
| `$store.calendar.mode`             | store  | El modo de selección.                             |
| `$store.calendar.prevMonth()`      | método | Un mes atrás.                                     |
| `$store.calendar.nextMonth()`      | método | Un mes adelante.                                  |
| `$store.calendar.goToMonth(date)`  | método | Saltar al mes de una fecha dada.                  |
| `$store.calendar.goToToday()`      | método | Saltar al mes actual.                             |
| `$store.calendar.select(date)`     | método | Seleccionar una fecha, respetando modo y límites. |
| `$store.calendar.isSelected(date)` | método | Si una fecha está seleccionada.                   |
| `$store.calendar.clear()`          | método | Limpiar la selección.                             |
| `$store.calendar.destroy()`        | método | Desarmar el store.                                |

`mode`, `month` y `selected` se leen del store. Los límites **no**: se setean en la factory
y guardas tu propia copia si los necesitas para comparar.

:::caution[`select()` respeta los límites; tu handler tiene que hacerlo por su cuenta]
El store rechaza en silencio una fecha fuera del rango y tampoco expone el rango. Si tu
celda maneja el click, chequea el límite que pasaste a la factory — si no, el botón
parece roto en el primer y el último mes, que es donde nadie prueba.
:::

## Opciones del plugin

```ts
calendarPlugin({ id: "app-calendar", storeKey: "cal" });
```
