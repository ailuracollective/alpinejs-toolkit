---
title: Geo
---

@ailura/alpinejs-geo

Un store `geo` para la Geolocation API: una lectura puntual, una suscripción continua, y
el estado de error cuando el usuario se niega. El plugin maneja el ciclo de vida; tú
renderizas las coordenadas.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-geo
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import geoPlugin from "@ailura/alpinejs-geo";

Alpine.plugin(geoPlugin());

Alpine.start();
```

Eso registra un store `geo`, así que todo lo de abajo vive en `$store.geo`.

## Ejemplo mínimo

Pedir una vez, y mostrar las coordenadas o el motivo de que no las hay.

```html
<div x-data>
  <p x-show="$store.geo.isSupported">
    <span x-text="$store.geo.latitude"></span>,
    <span x-text="$store.geo.longitude"></span>
    ±<span x-text="$store.geo.accuracy"></span> m
  </p>

  <p x-show="!$store.geo.isSupported">Este browser no tiene Geolocation.</p>

  <p x-show="$store.geo.isLoading">Buscando ubicación…</p>
  <p x-show="$store.geo.hasError">
    <span x-text="$store.geo.errorCode"></span>:
    <span x-text="$store.geo.error"></span>
  </p>

  <button @click="$store.geo.request()">Encontrarme</button>
  <button @click="$store.geo.reset()">Limpiar</button>
</div>
```

Usa los predicados, no los valores. `hasPosition` y `hasError` son los que te dicen en
cuál de tres estados estás, y en los otros dos todos los valores son `null`.

## Una lectura o una suscripción

`request()` lee una vez. `watch()` sigue leyendo mientras esté en pantalla, y
`unwatch()` para. Suscribirse sin desuscribirse deja el GPS prendido y descarga la
batería.

```js
$store.geo.request({ enableHighAccuracy: true, timeout: 10000 });
$store.geo.watch();
$store.geo.unwatch();
```

`request()` y `watch()` toman las opciones de posición de la plataforma:
`enableHighAccuracy`, `timeout` y `maximumAge`.

`isWatching` es el flag para el estado del botón.

## El permiso hay que pedirlo desde un gesto

`request()` y `watch()` disparan ambos un prompt del browser, y el browser solo lo permite
desde un gesto del usuario. Llamar cualquiera de los dos durante la carga de la página se
rechaza, y el error que recibes es de permiso, no de gesto faltante.

:::caution[Distinguí "denegado" de "no disponible" en la UI]
`errorCode` te dice por qué: el usuario dijo que no, la posición no está disponible, la
petición expiró, o el browser no tiene Geolocation. Solo el primero vale la pena pedirle
un cambio al usuario, así que bifurca por `errorCode` en vez de mostrar el mismo mensaje
para los cuatro.
:::

## Referencia de la API

| Nombre                                                           | Tipo   | Para qué sirve                                                                                                                                                                  |
| ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$store.geo.request()`                                           | método | Leer la posición una vez.                                                                                                                                                       |
| `$store.geo.watch()`                                             | método | Empezar actualizaciones continuas.                                                                                                                                              |
| `$store.geo.unwatch()`                                           | método | Parar las actualizaciones continuas.                                                                                                                                            |
| `$store.geo.reset()`                                             | método | Limpiar la posición y el error.                                                                                                                                                 |
| `$store.geo.destroy()`                                           | método | Teardown a cargo del host: libera la suscripción de `watchPosition` que inició un `watch()`. Nadie lo llama por usted. `unwatch()` sigue parando una suscripción por su cuenta. |
| `$store.geo.latitude` / `longitude`                              | store  | Las coordenadas.                                                                                                                                                                |
| `$store.geo.accuracy`                                            | store  | Radio de la fijación, en metros.                                                                                                                                                |
| `$store.geo.altitude` / `altitudeAccuracy` / `heading` / `speed` | store  | El resto de `GeolocationPosition`, cuando el browser lo provee.                                                                                                                 |
| `$store.geo.timestamp`                                           | store  | Cuándo se tomó la lectura.                                                                                                                                                      |
| `$store.geo.isSupported`                                         | store  | Si el browser tiene Geolocation.                                                                                                                                                |
| `$store.geo.isLoading` / `loading`                               | store  | Si hay una lectura en curso.                                                                                                                                                    |
| `$store.geo.isWatching` / `watching`                             | store  | Si hay una suscripción corriendo.                                                                                                                                               |
| `$store.geo.hasPosition`                                         | store  | Si hay una posición para mostrar.                                                                                                                                               |
| `$store.geo.hasError` / `error` / `errorCode`                    | store  | Por qué falló el último intento.                                                                                                                                                |

## Opciones del plugin

```ts
geoPlugin({ id: "app-geo", storeKey: "position" });
```
