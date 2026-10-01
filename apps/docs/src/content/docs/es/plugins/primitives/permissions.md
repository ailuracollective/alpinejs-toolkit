---
title: Permissions
---

@ailura/alpinejs-permissions

Un registro de permisos del browser — geolocalización, notificaciones, cámara,
micrófono — detrás de funciones adaptadoras, para preguntar una vez y leer el estado en
todos lados.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-permissions
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import permissionsPlugin from "@ailura/alpinejs-permissions";

Alpine.plugin(permissionsPlugin());

Alpine.start();
```

Eso registra un store `permissions`, así que todo lo de abajo vive en
`$store.permissions`. El mismo objeto te lo entrega el magic `$permissions`.

## Ejemplo mínimo

Registrar un permiso, consultarlo y pedirlo desde un click.

```html
<div x-data>
  <p>
    Notificaciones:
    <span x-text="$store.permissions.registry.notifications?.permission ?? 'desconocido'"></span>
  </p>

  <button
    @click="$store.permissions.request('notifications')"
    :disabled="!$store.permissions.registry.notifications?.canRequest"
  >
    Permitir notificaciones
  </button>
</div>
```

Vinculá por `registry`, que es un registro reactivo de todos los permisos registrados.
`get(name)` devuelve el mismo snapshot para una lectura puntual, pero no pasa por el
registro reactivo, así que un template que se vincula a él no se vuelve a renderizar
cuando cambia. Llamar `query()` en cada render en vez de eso significa preguntarle al
browser en cada render, que es más lento y puede volver a disparar el prompt.

## Registrar lo que necesitas de antemano

`register()` toma un solo objeto adaptador — el nombre es una propiedad suya, no un
argumento aparte — y devuelve una función que lo da de baja de nuevo. El store puede
decirte si el pedido siquiera es posible antes de que ofrezcas el botón.

```js
const unregister = $store.permissions.register({
  name: "camera",
  isSupported: () => "mediaDevices" in navigator,
  getAvailability: () => "available",
  query: async () => (await navigator.permissions.query({ name: "camera" })).state,
  request: async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    return { permission: "granted", result: stream };
  },
});
```

Los adaptadores también se le pueden pasar al plugin, que es donde los pone la mayoría
de las aplicaciones: `permissionsPlugin({ adapters: [cameraAdapter] })`. Registrar el
mismo nombre dos veces tira, así que elegí una de las dos formas.

## Observar revocaciones

Un usuario puede revocar un permiso desde la UI del browser mientras tu página está
abierta. `watch()` mantiene el store sincronizado en vez de dejarlo mostrando un
"permitido" viejo. Resuelve a la función que deja de mirar — no hay `unwatch()` en el
store.

```js
const stop = await $store.permissions.watch("camera");
```

Llamá a `stop()` cuando el componente se vaya, o el listener le sobrevive. Los
adaptadores solo se suscriben si implementan `subscribe()`; el que no lo hace te entrega
una función inerte que no libera nada.

## Referencia de la API

| Nombre                                       | Tipo   | Para qué sirve                                                                                                                   |
| -------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `$store.permissions.registry`                | store  | Registro reactivo de todos los permisos registrados, por nombre.                                                                 |
| `$store.permissions.get(name)`               | método | El último snapshot conocido de un permiso, sin pegarle al browser.                                                               |
| `$store.permissions.query(name)`             | método | Preguntar al browser por el estado actual.                                                                                       |
| `$store.permissions.refresh(name)`           | método | Re-consultar un permiso — la misma llamada que `query()`.                                                                        |
| `$store.permissions.request(name, options?)` | método | Disparar el prompt. Llamar desde un gesto. `options` va al adaptador.                                                            |
| `$store.permissions.watch(name)`             | método | Mantener el estado sincronizado; resuelve a una función que deja de mirar.                                                       |
| `$store.permissions.register(adapter)`       | método | Declarar un permiso y cómo pedirlo. Devuelve una función para darlo de baja.                                                     |
| `$store.permissions.destroy()`               | método | Teardown a cargo del host: cancela cada suscripción de permiso y descarta los adaptadores registrados. Nadie lo llama por usted. |

Cada permiso registrado reporta `permission` (`granted`, `prompt`, `denied` o
`unknown`), `availability`, `requestState`, `canRequest`, `requiresUserGesture`, `error`
y `result`.

:::caution[`request()` fuera de un gesto de usuario falla como error de permiso]
El browser rechaza el prompt, y lo que vuelve parece que el usuario dijo que no. Un
botón que lo llama desde un hook de `mounted` va a quedar permanentemente denegado, y el
diagnóstico que ayuda es `error` en el snapshot — `requiresUserGesture` se reporta como
`true` en todos los permisos, así que no te dice nada sobre uno en particular.
:::

## Opciones del plugin

```ts
permissionsPlugin({ storeKey: "perms", magicKey: "can", adapters: [cameraAdapter] });
```
