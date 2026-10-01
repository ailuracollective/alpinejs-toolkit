---
title: Env
---

@ailura/alpinejs-env

Un solo magic reactivo para el entorno del browser: `$env`. Proyecta network, visibility,
battery y platform como una vista agregada, y re-renderiza cuando el browser cambia. Sin
store, sin registro, sin ciclo de vida. Es una proyección sobre APIs del browser, y se
actualiza sola.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-env
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import envPlugin from "@ailura/alpinejs-env";

Alpine.plugin(envPlugin());

Alpine.start();
```

Eso registra un magic. No hay nada más que hacer — sin `register()`, sin ids.

## Ejemplo mínimo

Leelo directo en el markup.

```html
<div x-data>
  <p x-show="!$env.network.online">Estás offline. Los cambios se sincronizan al volver.</p>
  <p x-show="!$env.visibility.visible">Pestaña oculta — pausando subidas.</p>
  <p>Plataforma: <span x-text="$env.platform.platform"></span></p>
  <p>
    Batería:
    <span
      x-text="$env.battery ? Math.round($env.battery.level * 100) + '%' : 'no disponible'"
    ></span>
  </p>
</div>
```

Nada lo consultas con polling: `$env.network.online` cambia con los eventos `online` y
`offline` del propio browser, y `$env.visibility.visible` con el cambio de visibilidad. La
vista es reactiva, así que un evento real re-renderiza los bindings que la leen.

## `$env.battery` es la excepción

La Battery Status API no está en todos lados: Firefox y Safari no la implementan, y
Chrome la sacó del origin de escritorio. Así que `$env.battery` es `null` en esos browsers en
lugar de un objeto con un nivel — la misma forma que tiene cuando apagás el dominio con
`envPlugin({ battery: false })`.

Ese `null` es la razón del guard en el ejemplo. Vincular a `$env.battery?.level` te tira en
producción exactamente en los browsers que no probaste.

```html
<span x-text="$env.battery?.level ?? null"></span>
```

## Referencia de la API

Cada dominio expone estado de solo lectura y un flag `supported` que te dice si el plugin
lo está siguiendo. El único método es `$env.destroy()`, el teardown que maneja el host.

| Nombre                      | Tipo                     | Devuelve                                                                                                                                                                           |
| --------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$env.network`              | propiedad (solo lectura) | Estado de conexión: `online`, y `effectiveType`, `saveData`, `downlink`, `rtt` cuando el browser los expone.                                                                       |
| `$env.network.supported`    | propiedad (solo lectura) | Si el dominio de red está activo.                                                                                                                                                  |
| `$env.visibility`           | propiedad (solo lectura) | `visible`, `hidden`, y el string crudo de `state`.                                                                                                                                 |
| `$env.visibility.supported` | propiedad (solo lectura) | Si el dominio de visibilidad está activo.                                                                                                                                          |
| `$env.battery`              | propiedad (solo lectura) | Un snapshot plano — `charging`, `level`, `chargingTime`, `dischargingTime` — o `null` si la API no existe o el dominio está apagado.                                               |
| `$env.platform`             | propiedad (solo lectura) | El estado de plataforma del navigator, con los flags `isIos` / `isAndroid` / `isMobile` / `isMac` / `isWindows`.                                                                   |
| `$env.platform.supported`   | propiedad (solo lectura) | Si el dominio de plataforma está activo.                                                                                                                                           |
| `$env.destroy()`            | método                   | Teardown del host: saca los listeners `online`/`offline` de `window` y `visibilitychange` de `document`. Nada lo invoca automáticamente — lo llama el host que registró el plugin. |

## Opciones del plugin

```ts
envPlugin({ envKey: "environment", battery: false });
```

| Opción       | Tipo      | Default | Para qué sirve                          |
| ------------ | --------- | ------- | --------------------------------------- |
| `envKey`     | `string`  | `"env"` | El nombre del magic.                    |
| `id`         | `string`  | auto    | El id del controller, para diagnóstico. |
| `network`    | `boolean` | `true`  | Seguir el dominio de red.               |
| `visibility` | `boolean` | `true`  | Seguir el dominio de visibilidad.       |
| `battery`    | `boolean` | `true`  | Seguir el dominio de batería.           |
| `platform`   | `boolean` | `true`  | Seguir el dominio de plataforma.        |

Apagar un dominio nunca lo saca de la vista: el agregado sigue completo, el dominio
reporta `supported: false` (o `null` en el caso de battery), y deja de re-renderizar.

:::note[`$env.platform.platform` es un string, no un booleano]
`$env.platform.platform` te da el valor crudo de `navigator.platform`. Detectar features con
este magic te dice lo que el browser dice ser, no lo que puede hacer; para chequear
capacidades, prueba la API que realmente necesitas.
:::
