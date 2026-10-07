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

## Favicon según el tema

`createThemeFaviconController` mantiene el icono del navegador apuntando al
tema que la página está mostrando de verdad. Funciona con Alpine o sin él: lee
`resolved` de un `ThemeController`, nunca del store.

### Cuando el icono solo sigue al SO

Escribe dos links en la plantilla y listo. Sin JavaScript, correcto antes de que
el bundle se analice, y el navegador reevalúa la media query por su cuenta:

```html
<link
  rel="icon"
  href="/favicon-light.svg"
  media="(prefers-color-scheme: light)"
  type="image/svg+xml"
/>
<link
  rel="icon"
  href="/favicon-dark.svg"
  media="(prefers-color-scheme: dark)"
  type="image/svg+xml"
/>
```

### Cuando la aplicación manda sobre el SO

Si `current` puede ser un `light`/`dark` explícito, ninguna media query
expresa "claro aunque la máquina esté en oscuro": sigue `resolved` en su lugar:

```ts
import { createThemeController, createThemeFaviconController } from "@ailura/alpinejs-theme";

const theme = createThemeController();

const favicon = createThemeFaviconController({
  theme, // opcional — por defecto, el controller singleton del paquete
  light: "/favicon-light.svg",
  dark: "/favicon-dark.svg",
  type: "image/svg+xml",
});

favicon.destroy(); // se desuscribe y elimina el <link> que creó
```

El tema inicial se aplica al momento, y cada `change` posterior reapunta el
mismo link. Llama a `favicon.apply()` cuando un router de cliente reemplace
`<head>`.

| Opción     | Por defecto               | Efecto                                        |
| ---------- | ------------------------- | --------------------------------------------- |
| `light`    | obligatoria               | Icono mientras `resolved` es `light`          |
| `dark`     | obligatoria               | Icono mientras `resolved` es `dark`           |
| `strategy` | `"theme"`                 | `"media"` escribe los dos links del navegador |
| `theme`    | `createThemeController()` | Origen de `resolved`; se ignora con `"media"` |
| `type`     | sin valor                 | Atributo `type` del link                      |
| `sizes`    | sin valor                 | Atributo `sizes` del link                     |
| `target`   | `document.head`           | Dónde se añade el link; `null` lo deja inerte |

El controlador añade su propio `<link rel="icon">` y lo recuerda **por
referencia**: los iconos ajenos del head nunca se leen, se reescriben ni se
eliminan, y `destroy()` solo se lleva lo que creó. Cada link propio lleva un
atributo `data-theme-favicon` para depurar. No se añade ningún parámetro
anti-caché — el razonamiento y la alternativa están en el README del paquete.

## Opciones del plugin

```ts
themePlugin({ storeKey: "appTheme" });
```
