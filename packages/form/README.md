# @ailura/alpinejs-form

<p align="center">

[![bundlephobia minzip](https://badgen.net/bundlephobia/minzip/@ailura/alpinejs-form)](https://bundlephobia.com/package/@ailura/alpinejs-form)

</p>

> Headless form state and validation — named forms, per-field dirty/touched/errors, sync or async validators, submit orchestration and server-error injection, on `@ailura/alpinejs-core`. No markup, no styles, no `x-model` replacement.

## Installation

```sh
pnpm add @ailura/alpinejs-form alpinejs
# or
npm install @ailura/alpinejs-form alpinejs
```

Requires `alpinejs@^3.0.0` as peer. `@ailura/alpinejs-core` is a **peer
dependency**, not a dependency: no package in this toolkit has a
`dependencies` block, so the host installs it too.

## Usage

### 1. Standalone (framework-agnostic)

```ts
import { createFormController } from "@ailura/alpinejs-form";

const ctrl = createFormController();
ctrl.create("login", { initialValues: { email: "", password: "" } });
ctrl.createField("login", "email", {
  validate: (v) => (v ? null : "Email is required"),
});

ctrl.setValue("login", "email", "ana@example.com");
ctrl.touch("login", "email");
await ctrl.validate("login"); // true
ctrl.snapshotInstances().login?.valid; // true
ctrl.destroy();
```

`createFormController()` calls `mount()` for you. Nothing here touches the
DOM, so a form can be validated in a test, a worker, or a server action.

### 2. Alpine

```ts
import Alpine from "alpinejs";
import formPlugin from "@ailura/alpinejs-form";

Alpine.plugin(formPlugin());
Alpine.start();
```

The plugin registers `$store.form`. Forms are addressed by **string id**, so
one store carries as many forms as a page has:

```html
<div
  x-data
  x-init="
    $store.form.create('login', { initialValues: { email: '' } });
    $store.form.createField('login', 'email', { validate: v => v ? null : 'Required' });
  "
>
  <input
    type="email"
    :value="$store.form.instances.login?.values?.email ?? ''"
    @input="$store.form.setValue('login', 'email', $event.target.value)"
    @blur="$store.form.touch('login', 'email')"
    :aria-invalid="String(!!$store.form.instances.login?.fields?.email?.errors?.length)"
  />
  <p
    x-show="$store.form.instances.login?.fields?.email?.errors?.length"
    x-cloak
    x-text="$store.form.instances.login?.fields?.email?.errors?.[0]"
  ></p>

  <button @click="$store.form.validate('login')">Validate</button>
</div>
```

Two things to notice in that markup, because they are the whole ergonomics of
the package:

- **`$store.form.instances.login` is a snapshot, not the live form.** It is
  rebuilt on every change, so bind through `?.` and never write to it — the way
  to change a value is `setValue()`.
- **The `validate` function is not the Alpine proxy.** Inside an `x-init`
  string it is a bare function, so it receives the value as its only argument
  and cannot read sibling fields. Move the state out to `x-data` when a
  validator needs the rest of the form.

## API

### Exports

| Export                   | Description                                                                                                  | Type       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | ---------- |
| `FormController`         | Framework-agnostic controller — owns every named form, emits `change`                                        | `class`    |
| `createFormController`   | `createFormController(options?) => FormController`, already `mount()`ed                                      | `function` |
| `formPlugin`             | `Alpine.plugin()` factory — `formPlugin(options?) => Plugin`; registers `$store.form`                        | `function` |
| `DEFAULT_FORM_STORE_KEY` | Default `$store` key — `"form"`                                                                              | `string`   |
| `FieldPath`              | `string`. A dot-separated path; nothing in the package parses the dots                                       | `type`     |
| `FieldValidator`         | `(value, ctx) => string \| null \| undefined \| Promise<…>` — the message, or nothing is wrong               | `type`     |
| `FieldValidationContext` | `{ path, values, signal }` passed as the validator's second argument                                         | `type`     |
| `FieldOptions`           | `{ initialValue?, validate? }`                                                                               | `type`     |
| `FieldState`             | One field's snapshot — `path`, `value`, `initialValue`, `dirty`, `touched`, `errors`, `validating`           | `type`     |
| `FormOptions`            | `{ initialValues? }`                                                                                         | `type`     |
| `FormInstance`           | One form's snapshot — `values`, `fields`, `dirty`, `touched`, `valid`, `invalid`, `submitting`, `formErrors` | `type`     |
| `FormResetOptions`       | `{ toCommitted? }` — **accepted and ignored**, see Limitations                                               | `type`     |
| `ServerFieldErrors`      | `Record<FieldPath, readonly string[]>` — the shape `setServerErrors` takes                                   | `type`     |
| `FormStore`              | The `$store.form` surface (see below)                                                                        | `type`     |
| `CreateFormOptions`      | `FormOptions` plus `id` and `storeKey`                                                                       | `type`     |
| `FormControllerOptions`  | `{ id? }`                                                                                                    | `type`     |
| `FormEvents`             | Event map — `change`, `submit`, `submit-error`                                                               | `type`     |
| `FormChangeDetail`       | `{ formId, source, fieldPath? }`                                                                             | `type`     |
| `FormAlpine`             | Typed view of `Alpine` the plugin uses                                                                       | `type`     |
| `FormPluginCallback`     | `Alpine.plugin()` callback signature                                                                         | `type`     |

### Controller API

| Member                                         | Description                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `create(id, options?)`                         | Make a form. Re-creating an id **replaces** it, values and all — handy after a view transition, destructive mid-edit |
| `createField(formId, path, options?)`          | Register a field. Silently returns if the path exists. Creates the form if it does not                               |
| `destroyField(formId, path)`                   | Remove the field **and** its entry in `values`                                                                       |
| `setValue(formId, path, value)`                | Write a value. `dirty` is `value !== initialValue` by reference, not a deep compare                                  |
| `getValue(formId, path)`                       | Read `values[path]`, or `undefined` if the form or path is unknown                                                   |
| `touch(formId, path)`                          | Mark a field touched. Does not validate                                                                              |
| `validate(formId)`                             | `Promise<boolean>`. Runs every validator **sequentially**; see Limitations for two things it clears                  |
| `submit(formId, handler)`                      | `Promise<void>`. Validates, then calls `handler(copy)`. **Rejects** on invalid form or handler throw                 |
| `reset(formId, options?)`                      | Back to `initialValue` for every field; clears `errors` and `formErrors`. `options` is ignored                       |
| `setServerErrors(formId, errors, formErrors?)` | Paint server errors onto registered fields. A path with no field is **skipped**                                      |
| `destroy(formId)`                              | Drop **one** form, controller still usable                                                                           |
| `destroy()`                                    | Drop every form **and** destroy the controller                                                                       |
| `destroyAll()`                                 | Drop every form, controller still usable                                                                             |
| `snapshotInstances()`                          | `Record<string, FormInstance>` — the same data the store publishes, for adapters and tests                           |

### Store API

```ts
// Lifecycle
$store.form.create("login", { initialValues: { email: "" } });
$store.form.destroy("login"); // one form
$store.form.destroyAll(); // every form, controller alive
$store.form.destroy(); // every form + the controller

// Fields
$store.form.createField("login", "email", {
  initialValue: "",
  validate: (value) => (value ? null : "Email is required"),
});
$store.form.destroyField("login", "email");

// Values
$store.form.setValue("login", "email", "ana@example.com");
$store.form.getValue("login", "email");
$store.form.touch("login", "email");

// Running
await $store.form.validate("login"); // → boolean
await $store.form.submit("login", async (values) => {
  await fetch("/login", { method: "POST", body: JSON.stringify(values) });
});
$store.form.reset("login");

// Server errors
$store.form.setServerErrors("login", { email: ["Already registered"] }, [
  "Please fix the highlighted fields",
]);

// Reading
$store.form.instances.login?.values; // { email: '…' }
$store.form.instances.login?.fields?.email?.errors; // ['…']
$store.form.instances.login?.dirty; // boolean
$store.form.instances.login?.touched;
$store.form.instances.login?.valid; // !invalid
$store.form.instances.login?.invalid;
$store.form.instances.login?.submitting;
$store.form.instances.login?.formErrors; // string[]
```

| Method                                         | Returns            | Notes                                                                        |
| ---------------------------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| `create(id, options?)`                         | `void`             | Replacing an id drops the previous form's fields and values                  |
| `destroy(id)` / `destroy()`                    | `void`             | One key, two arities. `destroy()` with no argument tears the controller down |
| `destroyAll()`                                 | `void`             |                                                                              |
| `createField(formId, path, options?)`          | `void`             | No-op if the path already exists                                             |
| `destroyField(formId, path)`                   | `void`             | Also deletes `values[path]`                                                  |
| `setValue(formId, path, value)`                | `void`             | Works on an unregistered path, but only `values[path]` moves                 |
| `getValue(formId, path)`                       | `unknown`          | `undefined` when the form or path is unknown                                 |
| `touch(formId, path)`                          | `void`             | Silent no-op for an unregistered path                                        |
| `validate(formId)`                             | `Promise<boolean>` | `false` for an unknown form id                                               |
| `submit(formId, handler)`                      | `Promise<void>`    | **Rejects** — `.catch()` it or you get an unhandled rejection                |
| `reset(formId, options?)`                      | `void`             | `options` is ignored                                                         |
| `setServerErrors(formId, errors, formErrors?)` | `void`             | Paths without a registered field are dropped                                 |

### Options

```ts
type CreateFormOptions = {
  id?: string; // controller id — defaults to generateId('form')
  storeKey?: string; // $store key — default 'form'
  initialValues?: Record<string, unknown>; // defaults for a form created by the plugin
};
```

| Option          | Default   | Effect                                                                       |
| --------------- | --------- | ---------------------------------------------------------------------------- |
| `initialValues` | `{}`      | Passed to the controller, not to any form. `create()` takes its own per form |
| `storeKey`      | `'form'`  | The `$store` key the plugin registers under                                  |
| `id`            | generated | Controller id. Nothing in the store exposes it                               |

Per form:

```ts
type FormOptions = { initialValues?: Record<string, unknown> };
type FieldOptions = {
  initialValue?: unknown; // defaults to values[path] at registration time
  validate?: FieldValidator;
};
```

`initialValue` is fixed at `createField()` time. `reset()` returns to it, and
there is no way to re-base it — see `FormResetOptions` below.

### Avoiding name collisions

```ts
Alpine.plugin(formPlugin({ storeKey: "checkout" })); // → $store.checkout
```

The exported constant `DEFAULT_FORM_STORE_KEY` keeps the rename discoverable
from TypeScript. There is no magic key — this package registers no magics.

### Events

```ts
import type { FormChangeDetail } from "@ailura/alpinejs-form";

ctrl.on("change", (detail: FormChangeDetail) => {
  detail.formId; // 'login'
  detail.source; // see below
  detail.fieldPath; // present on register / value / touch
});
ctrl.on("submit", ({ formId, values }) => {
  /* the handler resolved */
});
ctrl.on("submit-error", ({ formId, error }) => {
  /* validation failed, or the handler threw — `error` tells you which */
});
```

`FormChangeSource` is
`'initialization' | 'register' | 'value' | 'touch' | 'validate' | 'submit' | 'reset' | 'server-error'`.
`'submit'` is emitted **twice** per `submit()` — once with `submitting: true`,
once in the `finally` with it false.

## Server errors

`setServerErrors()` is the one call that has no client equivalent: it paints a
response body onto the form you already have, so a 422 does not mean
reconstructing the form.

```ts
try {
  await fetch("/signup", { method: "POST", body: JSON.stringify(values) });
} catch {
  $store.form.setServerErrors("signup", { email: ["Already registered"] }, [
    "Two fields need attention",
  ]);
}
```

Form-level messages land in `formErrors`; field messages replace that field's
`errors` array. They survive until the next `validate()` or `reset()` — see
Limitations for the asymmetry between the two.

## SSR

> SSR-safe — no `window`/`document` is touched anywhere, import time included.
> The controller is plain state, so `validate()` and `submit()` work in a
> server action. `FieldValidationContext.signal` is a real `AbortSignal` but it
> is never aborted.

## Limitations

- **`FormResetOptions.toCommitted` is ignored.** It is in the published type
  and `reset(formId, options)` accepts it, but the controller always returns
  to `initialValue`, which is fixed when the field is created. There is no
  committed state to roll back to.
- **`validate()` clears the errors of any field without a `validate`
  function.** That is what makes server errors vanish the next time anything
  validates. `formErrors` are _not_ cleared by `validate()`, so form-level
  messages behave differently from field-level ones.
- **`submit()` rejects instead of returning a status.** A form that failed
  validation and a form whose handler threw produce the same rejection; the
  difference is only in the `submit-error` event. Catch it at the call site or
  you get an unhandled rejection in the click handler.
- **Validators run sequentially, not concurrently.** Each `await` is inside the
  loop, so a validator that hits the network serialises the whole form. Wrap
  your own `Promise.all` inside a single validator if you need parallelism.
- **`ctx.signal` is never aborted.** A fresh `AbortController` per field, per
  run. A validator racing two runs (blur then submit) must compare `ctx.values`
  before it acts on its result.
- **`dirty` is a reference comparison.** An object or array field is dirty from
  the moment it holds anything other than the identical reference, and the only
  way to clear it is to set it back to that same reference.
- **`FieldPath` is an opaque string.** Dots are not parsed, so `address.city`
  is one flat key. Nested paths are not a feature here.
- **`create()` on an existing id replaces the form**, fields included. Calling
  it from `x-init` on a view transition therefore resets the form — which is
  usually what you want and occasionally is not.
- **No markup, no styles, no ARIA.** `aria-invalid` and `role="alert"` in the
  usage example are the page's, not the package's. Nothing here produces an
  error message element, and nothing ties an error to the input that caused it.

## Size

`4.93 kB raw / 1.57 kB gzip` · budget `3 kB` · externalized peers: `alpinejs`, `@ailura/alpinejs-core` · `size-limit` + `publint` + `attw` verified.

## Architecture

[Primitives layer](../../ARCHITECTURE.md) — controllers own state, Alpine owns reactivity. See canon, guards, and SSR rules in [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Testing

```sh
pnpm test              # vp test (happy-dom)
pnpm run typecheck     # tsc --noEmit
```

Uses `@ailura/alpinejs-testing` — `html`/`mount`/`settled`/`start`/`resume`/`reset`. See [ARCHITECTURE.md §8](../../ARCHITECTURE.md).

## License

MIT
