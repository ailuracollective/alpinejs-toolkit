---
title: Form
---

@ailura/alpinejs-form

Un store de formularios: estado de los campos, validación, tracking de "sucio" y envío.
El plugin maneja el valor y los errores; tú vinculas los inputs y renderizas los
mensajes.

## Instalar

```sh
pnpm add alpinejs @ailura/alpinejs-form
```

## Registrar el plugin

Una vez, antes de `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import formPlugin from "@ailura/alpinejs-form";

Alpine.plugin(formPlugin());

Alpine.start();
```

Eso registra un store `form`, así que todo lo de abajo vive en `$store.form`.

## Ejemplo mínimo

Un formulario con dos campos y validación al perder foco.

```html
<div
  x-data="{ fid: 'signup' }"
  x-init="
    $store.form.register(fid, {
      initialValues: { email: '', password: '' },
    });
    $store.form.registerField(fid, 'email', {
      validate: (value) => (value ? null : 'El email es obligatorio'),
    });
    $store.form.registerField(fid, 'password', {
      validate: (value) => (String(value).length >= 8 ? null : 'Mínimo 8 caracteres'),
    });
  "
>
  <label>
    Email
    <input
      type="email"
      @input="$store.form.setValue(fid, 'email', $event.target.value)"
      @blur="$store.form.touch(fid, 'email')"
    />
  </label>

  <label>
    Contraseña
    <input
      type="password"
      @input="$store.form.setValue(fid, 'password', $event.target.value)"
      @blur="$store.form.touch(fid, 'password')"
    />
  </label>

  <button @click="$store.form.submit(fid, (values) => post('/signup', values)).catch(() => {})">
    Crear cuenta
  </button>
</div>
```

`registerField()` solo acepta `initialValue` y `validate`; las reglas viven en el
validador, que devuelve un string de error o `null` cuando el valor es aceptable. Se lo
llama con `(value, { path, values, signal })` y puede ser asíncrono.

Leé el estado de cada instancia por `$store.form.instances[fid]` — ese registro tiene
`values`, `fields`, `dirty`, `touched`, `valid`, `invalid`, `submitting` y `formErrors`,
y es el reactivo.

## Los errores del servidor no son los del cliente

Cuando el servidor rechaza un envío, esos errores van en los campos, no en un banner.
`setServerErrors()` los deja donde `validate()` los habría puesto. El mapa de campos guarda
arrays de mensajes, y el segundo argumento es la lista a nivel de formulario.

```js
$store.form.setServerErrors(fid, { email: ["Esa dirección ya está registrada."] }, [
  "Revisá los campos marcados.",
]);
```

## Leer el valor de vuelta

`getValue(formId, path)` lee el valor actual de un campo. El handler de envío recibe
todo el objeto `values`, así que normalmente no necesitas llamarlo.

```js
$store.form.submit(fid, async (values) => {
  await fetch("/signup", { method: "POST", body: JSON.stringify(values) });
});
```

`reset()` devuelve los campos a `initialValues` y limpia los errores, que es lo que hay
que hacer después de un envío exitoso.

```js
$store.form.reset(fid);
```

## Referencia de la API

| Nombre                                                 | Tipo   | Para qué sirve                                                                                                           |
| ------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `$store.form.register(id, options?)`                   | método | Crear una instancia. Opción: `initialValues`.                                                                            |
| `$store.form.unregister(id)`                           | método | Dar de baja una instancia.                                                                                               |
| `$store.form.registerField(id, path, options?)`        | método | Agregar un campo. `path` es la clave bajo la que se guarda el valor, ej. `email`. Opciones: `initialValue` y `validate`. |
| `$store.form.unregisterField(id, path)`                | método | Quitar un campo.                                                                                                         |
| `$store.form.setValue(id, path, value)`                | método | Setear el valor de un campo.                                                                                             |
| `$store.form.getValue(id, path)`                       | método | Leer el valor de un campo.                                                                                               |
| `$store.form.touch(id, path)`                          | método | Marcar un campo como tocado.                                                                                             |
| `$store.form.validate(id)`                             | método | Correr el validador de cada campo; resuelve a un booleano.                                                               |
| `$store.form.setServerErrors(id, errors, formErrors?)` | método | Adjuntar errores que vienen de un servidor.                                                                              |
| `$store.form.submit(id, handler)`                      | método | Validar y pasarle los valores a tu handler. Tira cuando la validación falla.                                             |
| `$store.form.reset(id)`                                | método | Volver a `initialValues`, con los errores limpiados.                                                                     |
| `$store.form.instances`                                | store  | Registro reactivo de todas las instancias.                                                                               |
| `$store.form.destroy()`                                | método | Desarmar el store.                                                                                                       |

:::caution[`submit()` tira cuando la validación falla]
`validate()` corre el validador de todos los campos, tocados o no, y `submit()` tira
cuando vuelve false — así que una promesa rechazada sin manejar en el handler del click
es exactamente lo que parece un formulario vacío. Atrápala, o chequeá
`instances[id].valid` después de validar vos. `touch()` es un flag que podés leer; no
gatea la validación.
:::

## Opciones del plugin

```ts
formPlugin({ id: "app-form", storeKey: "forms" });
```
