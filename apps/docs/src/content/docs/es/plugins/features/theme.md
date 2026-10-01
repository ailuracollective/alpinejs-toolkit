---
title: Theme
---

@ailura/alpinejs-theme

Tema claro, oscuro o del sistema, respaldado por una máquina de estados, así que el
toggle es una transición real con un valor real. El plugin aplica el tema al documento y
lo mantiene sincronizado con el sistema operativo y con otras pestañas; tú renderizas
el control.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-theme
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import themePlugin from "@ailura/alpinejs-theme";

Alpine.plugin(themePlugin());

Alpine.start();
```

Eso registra un store `theme`, así que todo lo de abajo vive en `$store.theme`.

## Ejemplo mínimo

Un switch de tres vías entre claro, oscuro y lo que diga el sistema.

```html
<div x-data>
  <button @click="$store.theme.toggle()" :aria-label="'Tema: ' + $store.theme.resolved">
    <span x-text="$store.theme.resolved"></span>
  </button>
</div>
```

Dos de los tres valores son distintos a propósito, y confundirlos es el bug habitual:

- `current` es lo que eligió el usuario. Es `"light"`, `"dark"` o `"system"`.
- `resolved` es lo que está realmente en pantalla ahora. Cuando `current` es
  `"system"`, `resolved` sigue al SO y puede cambiar sin que el usuario haga nada.

Vincula la UI a `resolved` y la acción a `current`, nunca al revés.

## Variantes

**Fuerza un valor en vez de seguir al sistema.** Usa `set()` cuando el usuario sobreescribió
la preferencia y tiene que Stick entre visitas.

```js
$store.theme.set("dark");
```

**Vuelve a seguir al SO.** Pasar `"system"` hace que el plugin vuelva a observar la
preferencia del sistema operativo.

```js
$store.theme.set("system");
```

**Vuelve a aplicar el tema al documento.** Útil si algo más reemplazó el atributo
`class` o `data-theme` del `<html>`, por ejemplo un widget de terceros.

```js
$store.theme.apply();
```

**Arranca desde una preferencia conocida en vez de la guardada.** La preferencia inicial
es `defaultTheme` en las opciones del plugin, no un argumento: `reset()` no recibe
nada, limpia la preferencia guardada y vuelve a `defaultTheme` (`"system"` si no la
configurás).

```js
$store.theme.reset();
```

## Referencia de la API

| Nombre                    | Tipo   | Para qué sirve                                                                                                                                                                 |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `$store.theme.current`    | store  | Lo que eligió el usuario: `light`, `dark` o `system`.                                                                                                                          |
| `$store.theme.resolved`   | store  | Lo que está en pantalla ahora, después de resolver `system`.                                                                                                                   |
| `$store.theme.system`     | store  | Lo que reporta el sistema operativo.                                                                                                                                           |
| `$store.theme.set(value)` | método | Fijar la preferencia y aplicarla.                                                                                                                                              |
| `$store.theme.toggle()`   | método | Alternar entre claro y oscuro.                                                                                                                                                 |
| `$store.theme.reset()`    | método | Limpiar la preferencia guardada y volver a `defaultTheme`. No recibe argumentos.                                                                                               |
| `$store.theme.apply()`    | método | Volver a aplicar el tema al target: una clase `dark`/`light` por defecto, o el atributo `data-theme` con `strategy: "attribute"`.                                              |
| `$store.theme.destroy()`  | método | Teardown del host: desuscribe el observer de tema del sistema y la suscripción de storage cross-tab. Nada lo invoca automáticamente — lo llama el host que registró el plugin. |

:::caution[`toggle()` ignora `"system"` a propósito]
`toggle()` alterna entre los dos valores concretos. Si `current` es `"system"`, llamarlo
salta a un valor fijo y deja de seguir al SO. Usa `set("dark")` si quieres abandonar el
sistema a propósito.
:::

## Opciones del plugin

```ts
themePlugin({ storeKey: "appTheme" });
```
