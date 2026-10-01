---
title: Form
---

@ailura/alpinejs-form

A form store: field state, validation, dirty tracking, and submission. The plugin owns
the value and the errors; you bind inputs and render the messages.

## Install

```sh
pnpm add alpinejs @ailura/alpinejs-form
```

## Register the plugin

Do this once, before `Alpine.start()`.

```ts
import Alpine from "alpinejs";
import formPlugin from "@ailura/alpinejs-form";

Alpine.plugin(formPlugin());

Alpine.start();
```

That registers a `form` store, so everything below is reachable at `$store.form`.

## Minimal example

A form with two fields and validation on blur.

```html
<div
  x-data="{ fid: 'signup' }"
  x-init="
    $store.form.register(fid, {
      initialValues: { email: '', password: '' },
    });
    $store.form.registerField(fid, 'email', {
      validate: (value) => (value ? null : 'Email is required'),
    });
    $store.form.registerField(fid, 'password', {
      validate: (value) => (String(value).length >= 8 ? null : 'At least 8 characters'),
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
    Password
    <input
      type="password"
      @input="$store.form.setValue(fid, 'password', $event.target.value)"
      @blur="$store.form.touch(fid, 'password')"
    />
  </label>

  <button @click="$store.form.submit(fid, (values) => post('/signup', values)).catch(() => {})">
    Sign up
  </button>
</div>
```

`registerField()` takes only `initialValue` and `validate`; the rules live in the
validator, which returns an error string or `null` when the value is acceptable. It is
called with `(value, { path, values, signal })` and may be async.

Read the per-instance state through `$store.form.instances[fid]` — that record holds
`values`, `fields`, `dirty`, `touched`, `valid`, `invalid`, `submitting` and
`formErrors`, and it is the reactive one.

## Server errors are not the same as client errors

When the server rejects a submission, those errors belong on the fields, not in a
banner. `setServerErrors()` puts them where `validate()` would have. The field map holds
arrays of messages, and the second argument is the form-level list.

```js
$store.form.setServerErrors(fid, { email: ["That address is already registered."] }, [
  "Check the highlighted fields.",
]);
```

## Reading the value back

`getValue(formId, path)` reads a single field's current value. The submit handler
receives the whole `values` object, so you usually do not need to call it.

```js
$store.form.submit(fid, async (values) => {
  await fetch("/signup", { method: "POST", body: JSON.stringify(values) });
});
```

`reset()` returns the fields to `initialValues` and clears the errors, which is the
right thing after a successful submit.

```js
$store.form.reset(fid);
```

## API reference

| Name                                                   | Type   | Purpose                                                                                                         |
| ------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------- |
| `$store.form.register(id, options?)`                   | method | Create an instance. Option: `initialValues`.                                                                    |
| `$store.form.unregister(id)`                           | method | Drop an instance.                                                                                               |
| `$store.form.registerField(id, path, options?)`        | method | Add a field. `path` is the key the value is stored under, e.g. `email`. Options: `initialValue` and `validate`. |
| `$store.form.unregisterField(id, path)`                | method | Remove a field.                                                                                                 |
| `$store.form.setValue(id, path, value)`                | method | Set a field's value.                                                                                            |
| `$store.form.getValue(id, path)`                       | method | Read one field's value.                                                                                         |
| `$store.form.touch(id, path)`                          | method | Mark a field as interacted with.                                                                                |
| `$store.form.validate(id)`                             | method | Run every field's validator; resolves to a boolean.                                                             |
| `$store.form.setServerErrors(id, errors, formErrors?)` | method | Attach errors that came from a server.                                                                          |
| `$store.form.submit(id, handler)`                      | method | Validate, then hand the values to your handler. Rejects when validation fails.                                  |
| `$store.form.reset(id)`                                | method | Back to `initialValues`, errors cleared.                                                                        |
| `$store.form.instances`                                | store  | Reactive registry of every instance.                                                                            |
| `$store.form.destroy()`                                | method | Tear the store down.                                                                                            |

:::caution[`submit()` rejects when validation fails]
`validate()` runs every validator on every field, touched or not, and `submit()` throws
when it comes back false — so an unhandled rejection in the click handler is what a
blank form looks like. Catch it, or check `instances[id].valid` after validating
yourself. `touch()` is a flag you can read; it does not gate validation.
:::

## Plugin options

```ts
formPlugin({ id: "app-form", storeKey: "forms" });
```
