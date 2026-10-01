---
title: Notify
---

@ailura/alpinejs-notify

Un magic `$notify` para notificaciones del browser, con el estado del permiso manejado
por tú y una variante que se queda callada en vez de tirar cuando el usuario no las
permitió.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-notify
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import notifyPlugin from "@ailura/alpinejs-notify";

Alpine.plugin(notifyPlugin());

Alpine.start();
```

Eso registra el magic `$notify`. No hay store.

## Ejemplo mínimo

Pedir el permiso, y notificar desde un gesto del usuario.

```html
<div x-data>
  <p>Permiso: <span x-text="$notify.permission"></span></p>
  <p x-show="!$notify.isSupported">Este browser no puede mostrar notificaciones.</p>

  <button @click="$notify.requestPermission()">Permitir notificaciones</button>
  <button
    @click="$notify.send('Build terminado', { body: 'Tu bundle está listo.' })"
    :disabled="$notify.permission !== 'granted'"
  >
    Notificame
  </button>
</div>
```

El método es `send(title, options?)` — el título es el primer argumento, no una propiedad
`title`. Todas las variantes de `send` lo toman así, y cada una devuelve la `Notification`
creada o `null`.

## Elegir entre `send` y `sendIfPermitted`

Esta es la decisión que importa, y es el motivo por el que existe este paquete.

- `send()` muestra la notificación. Si el permiso nunca fue concedido, no hace nada y
  al usuario nunca se le explica por qué.
- `sendIfPermitted()` hace lo mismo pero solo si el permiso ya está en `granted`, así que
  podés caer a otra cosa cuando devuelve `null`.

Para un evento que el usuario pidió explícitamente —"avisame cuando termine el deploy"—
usa `sendIfPermitted()` y maneja el `null` mostrando tu propio mensaje en la app.

```js
$notify.sendIfPermitted("Desplegado", { body: "El build está en vivo." });
```

**Devolvé una promesa cuando necesites saber el resultado.** `sendAsync(title, options?)`
es la única variante que pide permiso cuando el estado sigue en `default`; resuelve a la
`Notification`, o a `null` si el usuario rechazó o el browser se negó.

```js
await $notify.sendAsync("Copiado");
```

**Descartar no está conectado.** `close(tag?)` existe por simetría de API, pero la API
simple de `Notification` no tiene forma de retirar una, así que hoy es un no-op. No
construyas un botón de descartar encima.

```js
$notify.close(tag);
```

:::caution[Pedir el permiso necesita un gesto del usuario]
`requestPermission()` solo funciona desde un click o una tecla. Llamarlo durante la carga
de la página, o desde dentro de una cadena de promesas, lo rechaza el browser y el
permiso queda en `default` — así que los botones se quedan deshabilitados para siempre.
:::

## Referencia de la API

| Nombre                                     | Tipo   | Para qué sirve                                                                                                                                                                |
| ------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$notify.isSupported`                      | getter | Si la Notification API está disponible.                                                                                                                                       |
| `$notify.permission`                       | getter | `granted`, `denied` o `default`.                                                                                                                                              |
| `$notify.requiresHomeScreenInstall`        | getter | Si este browser necesita la app instalada para notificar.                                                                                                                     |
| `$notify.requestPermission()`              | método | Preguntarle al usuario. Desde un gesto. Resuelve al nuevo permiso.                                                                                                            |
| `$notify.send(title, options?)`            | método | Mostrar una notificación. Devuelve la `Notification`, o `null`.                                                                                                               |
| `$notify.sendAsync(title, options?)`       | método | Pedir permiso si sigue en `default` y mostrarla. Resuelve a la `Notification`, o `null`.                                                                                      |
| `$notify.sendIfPermitted(title, options?)` | método | Mostrarla solo si ya está concedido. Devuelve la `Notification`, o `null`.                                                                                                    |
| `$notify.close(tag?)`                      | método | Existe por simetría; un no-op con la API simple de `Notification`.                                                                                                            |
| `$notify.destroy()`                        | método | Teardown a cargo del host: desregistra el service worker que registró este plugin, y solo ese — nunca un barrido de los registros de la aplicación. Nadie lo llama por usted. |

## Opciones del plugin

```ts
notifyPlugin({ magicKey: "notifyUser" });
```
