import { BaseController } from "@ailura/alpinejs-core/controller";
import { generateId } from "@ailura/alpinejs-core/ids";

import type { FormEvents } from "./events";
import type {
  FieldOptions,
  FieldPath,
  FieldState,
  FieldValidator,
  FormControllerOptions,
  FormInstance,
  FormOptions,
  FormResetOptions,
  FormStore,
  ServerFieldErrors,
} from "./types";

interface InternalField {
  path: FieldPath;
  initialValue: unknown;
  value: unknown;
  dirty: boolean;
  touched: boolean;
  errors: string[];
  validating: boolean;
  validator?: FieldValidator;
}

interface InternalForm {
  values: Record<string, unknown>;
  initialValues: Record<string, unknown>;
  fields: Record<FieldPath, InternalField>;
  formErrors: string[];
  submitting: boolean;
}

function snapshotField(field: InternalField): FieldState {
  return {
    path: field.path,
    value: field.value,
    initialValue: field.initialValue,
    dirty: field.dirty,
    touched: field.touched,
    errors: [...field.errors],
    validating: field.validating,
  };
}

function snapshotForm(form: InternalForm): FormInstance {
  const fields: Record<FieldPath, FieldState> = {};
  for (const k in form.fields) {
    const field = form.fields[k];
    if (field) fields[k] = snapshotField(field);
  }
  const hasErrors =
    Object.values(form.fields).some((f) => f.errors.length > 0) || form.formErrors.length > 0;
  return {
    values: { ...form.values },
    fields,
    dirty: Object.values(form.fields).some((f) => f.dirty),
    touched: Object.values(form.fields).some((f) => f.touched),
    valid: !hasErrors,
    invalid: hasErrors,
    submitting: form.submitting,
    formErrors: [...form.formErrors],
  };
}

/**
 * One form, one namespace of fields.
 *
 * Forms are addressed by string id rather than by controller instance: a page
 * with two forms on it shares one `$store.form`, and the id is what tells
 * `setValue('login', 'email', …)` from `setValue('signup', 'email', …)`.
 */
export class FormController extends BaseController<FormEvents> {
  readonly id: string;
  #forms: Record<string, InternalForm> = {};

  constructor(id?: string) {
    super();
    this.id = id ?? generateId("form");
  }

  private get frozen(): boolean {
    return this.lifecycle === "destroyed";
  }

  snapshotInstances(): Record<string, FormInstance> {
    const out: Record<string, FormInstance> = {};
    for (const id in this.#forms) {
      const form = this.#forms[id];
      if (form) out[id] = snapshotForm(form);
    }
    return out;
  }

  create(id: string, options: FormOptions = {}): void {
    if (this.frozen) return;
    this.#forms[id] = {
      values: { ...options.initialValues },
      initialValues: { ...options.initialValues },
      fields: {},
      formErrors: [],
      submitting: false,
    };
    this.emit("change", { formId: id, source: "initialization" });
  }

  /**
   * `destroy(formId)` drops ONE form; `destroy()` tears down the controller.
   *
   * The overload exists because `BaseController.destroy()` is the controller's
   * own teardown and cannot be renamed. The argument is what separates them.
   */
  override destroy(formId?: string): void {
    if (this.frozen) return;
    if (formId === undefined) {
      for (const id of Object.keys(this.#forms)) this.#destroyInstance(id);
      super.destroy();
      return;
    }
    this.#destroyInstance(formId);
  }

  /** Destroy every form, leaving the controller itself usable. */
  destroyAll(): void {
    if (this.frozen) return;
    for (const id of Object.keys(this.#forms)) this.#destroyInstance(id);
  }

  #destroyInstance(formId: string): void {
    delete this.#forms[formId];
    this.emit("change", { formId, source: "initialization" });
  }

  /**
   * Register a field. Re-registering a path is a no-op, so a re-run `x-init`
   * after a view transition does not reset what the user has typed.
   *
   * Creates the form if it does not exist, with **no** `initialValues` — a
   * field created before its form still works, but the form's `values` will
   * not carry the form-level defaults.
   */
  createField(formId: string, path: FieldPath, options: FieldOptions = {}): void {
    if (this.frozen) return;
    const form = (this.#forms[formId] ??= {
      values: {},
      initialValues: {},
      fields: {},
      formErrors: [],
      submitting: false,
    });
    const existing = form.fields[path];
    if (existing) return;
    const initial = options.initialValue ?? (form.values[path] as unknown);
    form.fields[path] = {
      path,
      initialValue: initial,
      value: initial,
      dirty: false,
      touched: false,
      errors: [],
      validating: false,
      validator: options.validate,
    };
    if (!(path in form.values)) form.values[path] = initial;
    this.emit("change", { formId, source: "register", fieldPath: path });
  }

  destroyField(formId: string, path: FieldPath): void {
    if (this.frozen) return;
    const form = this.#forms[formId];
    if (!form) return;
    delete form.fields[path];
    delete form.values[path];
    this.emit("change", { formId, source: "register", fieldPath: path });
  }

  /**
   * `dirty` is `value !== initialValue` with `!==`, not a deep compare: an
   * object or array field is dirty from the moment it holds anything other
   * than the identical reference, and setting it back to that same reference
   * is the only way to clear the flag.
   *
   * A path with no registered field is still written to `values` — it just
   * never gets `dirty`/`touched`/`errors`, because there is no field to hold
   * them.
   */
  setValue(formId: string, path: FieldPath, value: unknown): void {
    if (this.frozen) return;
    const form = this.#forms[formId];
    if (!form) return;
    const field = form.fields[path];
    if (field) {
      field.value = value;
      field.dirty = value !== field.initialValue;
    }
    form.values[path] = value;
    this.emit("change", { formId, source: "value", fieldPath: path });
  }

  getValue(formId: string, path: FieldPath): unknown {
    return this.#forms[formId]?.values[path];
  }

  touch(formId: string, path: FieldPath): void {
    if (this.frozen) return;
    const field = this.#forms[formId]?.fields[path];
    if (!field) return;
    field.touched = true;
    this.emit("change", { formId, source: "touch", fieldPath: path });
  }

  /**
   * Run every field validator in turn and return whether the form is clean.
   *
   * Two behaviours worth knowing before you wire this to a button:
   *
   *  - A field with **no** `validate` has its errors cleared, not preserved.
   *    That is what makes `setServerErrors()` output disappear the next time
   *    anything validates, and it is deliberate: `validate()` claims to be the
   *    authority on a field's errors, and an unvalidated field has none.
   *  - `formErrors` are *not* cleared here, so a server-side form-level error
   *    keeps the form invalid until `reset()` or another `setServerErrors()`.
   *
   * Validators run sequentially, not concurrently: each `await` is inside the
   * loop. A field validator that does I/O therefore serialises the form.
   */
  async validate(formId: string): Promise<boolean> {
    const form = this.#forms[formId];
    if (!form) return false;
    let valid = true;
    for (const field of Object.values(form.fields)) {
      field.validating = true;
      if (field.validator) {
        const res = await field.validator(field.value, {
          path: field.path,
          values: form.values,
          // A fresh signal per field, never aborted: the context carries the
          // shape an async validator expects, but nothing here cancels it.
          // A validator that races two validations (blur + submit) must guard
          // its own result by comparing `ctx.values` before it writes.
          signal: new AbortController().signal,
        });
        field.errors = res ? [res] : [];
        if (field.errors.length) valid = false;
      } else field.errors = [];
      field.validating = false;
    }
    if (form.formErrors.length) valid = false;
    this.emit("change", { formId, source: "validate" });
    return valid;
  }

  /**
   * Validate, then hand a **copy** of the values to `handler`.
   *
   * Rejects — it does not swallow — on both validation failure and whatever
   * `handler` throws, so an unhandled rejection in a click handler is the
   * normal outcome of an invalid form. Catch it at the call site.
   */
  async submit(
    formId: string,
    handler: (values: Readonly<Record<string, unknown>>) => void | Promise<void>
  ): Promise<void> {
    const form = this.#forms[formId];
    if (!form) return;
    form.submitting = true;
    this.emit("change", { formId, source: "submit" });
    try {
      const ok = await this.validate(formId);
      // The rejection *is* the signal: there is no boolean return, so a form
      // that failed validation looks exactly like one whose handler threw.
      // `submit-error` carries whichever it was.
      if (!ok) throw new Error("validation failed");
      await handler({ ...form.values });
      this.emit("submit", { formId, values: { ...form.values } });
    } catch (e) {
      this.emit("submit-error", { formId, error: e });
      throw e;
    } finally {
      form.submitting = false;
      this.emit("change", { formId, source: "submit" });
    }
  }

  /**
   * Return every field to its `initialValue` and clear all errors.
   *
   * `FormResetOptions.toCommitted` is accepted and **ignored**: the option is
   * part of the published type, and there is no committed state to roll back
   * to — `initialValue` is fixed when the field is created.
   */
  reset(formId: string, _options?: FormResetOptions): void {
    const form = this.#forms[formId];
    if (!form) return;
    form.values = { ...form.initialValues };
    for (const field of Object.values(form.fields)) {
      field.value = field.initialValue;
      field.dirty = false;
      field.touched = false;
      field.errors = [];
    }
    form.formErrors = [];
    this.emit("change", { formId, source: "reset" });
  }

  /**
   * Paint errors that came from the server onto registered fields.
   *
   * A path with no field is skipped: there is no field to attach an error to,
   * and inventing one would put an `x-text` target in the snapshot that no
   * input owns. Pass form-level messages as the second argument.
   */
  setServerErrors(
    formId: string,
    errors: ServerFieldErrors,
    formErrors: readonly string[] = []
  ): void {
    const form = this.#forms[formId];
    if (!form) return;
    for (const [path, msgs] of Object.entries(errors)) {
      const field = form.fields[path];
      if (field) field.errors = [...msgs];
    }
    form.formErrors = [...formErrors];
    this.emit("change", { formId, source: "server-error" });
  }

  toStore(): FormStore {
    return {
      // A fresh record, never the private registry: the plugin's sync writes
      // plain snapshots here, so aliasing the private map would destroy the
      // controller's internal instance state. A stable field, not a getter:
      // a per-read getter would hand out a throwaway record that sync fills
      // and discards, leaving `$store.form.instances` permanently empty.
      instances: {} as FormStore["instances"],
      create: (id, o) => this.create(id, o),
      // One key, both arities, argument forwarded: `destroy: () =>
      // this.destroy()` would make `store.destroy("demo")` tear the controller
      // down instead of one form.
      destroy: (id?: string) => this.destroy(id),
      destroyAll: () => this.destroyAll(),
      createField: (fid, p, o) => this.createField(fid, p, o),
      destroyField: (fid, p) => this.destroyField(fid, p),
      setValue: (fid, p, v) => this.setValue(fid, p, v),
      getValue: (fid, p) => this.getValue(fid, p),
      touch: (fid, p) => this.touch(fid, p),
      validate: (fid) => this.validate(fid),
      submit: (fid, h) => this.submit(fid, h),
      reset: (fid, o) => this.reset(fid, o),
      setServerErrors: (fid, e, fe) => this.setServerErrors(fid, e, fe),
    };
  }
}

export function createFormController(options: FormControllerOptions = {}): FormController {
  const controller = new FormController(options.id);
  controller.mount();
  return controller;
}
