import type { Alpine } from "alpinejs";

/** Dot-separated field path. */
export type FieldPath = string;

/** Synchronous or asynchronous field validator. */
export type FieldValidator = (
  value: unknown,
  ctx: FieldValidationContext
) => string | null | undefined | Promise<string | null | undefined>;

export interface FieldValidationContext {
  readonly path: FieldPath;
  readonly values: Readonly<Record<string, unknown>>;
  readonly signal: AbortSignal;
}

/** Per-field state snapshot. */
export interface FieldState {
  readonly path: FieldPath;
  readonly value: unknown;
  readonly initialValue: unknown;
  readonly dirty: boolean;
  readonly touched: boolean;
  readonly errors: readonly string[];
  readonly validating: boolean;
}

/** Per-form instance state snapshot. */
/**
 * A form as the store reports it: a plain snapshot rebuilt on every event.
 *
 * Read it, do not write it. `values` is a shallow copy taken at sync time, so
 * mutating it in place changes nothing that will ever be rendered; the way to
 * change a value is `setValue()`.
 */
export interface FormInstance {
  readonly values: Readonly<Record<string, unknown>>;
  readonly fields: Readonly<Record<FieldPath, FieldState>>;
  readonly dirty: boolean;
  readonly touched: boolean;
  readonly valid: boolean;
  readonly invalid: boolean;
  readonly submitting: boolean;
  readonly formErrors: readonly string[];
}

/** Options for `formPlugin()` — per-form options plus the store rename. */
export type CreateFormOptions = FormOptions & {
  readonly id?: string;
  readonly storeKey?: string;
};

/** Options passed when creating a form instance. */
export interface FormOptions {
  readonly initialValues?: Readonly<Record<string, unknown>>;
}

/** Options passed when creating a field inside a form. */
export interface FieldOptions {
  readonly initialValue?: unknown;
  readonly validate?: FieldValidator;
}

/**
 * Options for reset.
 *
 * `toCommitted` is accepted and ignored by the controller — see
 * `FormController.reset()`. It is declared because it is part of the published
 * type; passing it changes nothing.
 */
export interface FormResetOptions {
  readonly toCommitted?: boolean;
}

export type ServerFieldErrors = Readonly<Record<FieldPath, readonly string[]>>;

/** Alpine-facing store surface. */
export interface FormStore {
  /**
   * Every live form, keyed by the id given to `create()`.
   *
   * The entry is replaced wholesale on each change, so `$watch` on
   * `instances.demo.fields.email.errors` fires once per event, not once per
   * field write.
   */
  readonly instances: Record<string, FormInstance>;
  /** Create a form. Re-creating an id replaces it. */
  create(id: string, options?: FormOptions): void;
  /**
   * Destroy ONE form, or the whole controller with no argument.
   *
   * Both arities through one key so `destroy(id)` cannot be confused with
   * `destroy()`.
   */
  destroy(id: string): void;
  destroy(): void;
  /** Destroy every form. */
  destroyAll(): void;
  createField(formId: string, path: FieldPath, options?: FieldOptions): void;
  destroyField(formId: string, path: FieldPath): void;
  setValue(formId: string, path: FieldPath, value: unknown): void;
  getValue(formId: string, path: FieldPath): unknown;
  touch(formId: string, path: FieldPath): void;
  validate(formId: string): Promise<boolean>;
  submit(
    formId: string,
    handler: (values: Readonly<Record<string, unknown>>) => void | Promise<void>
  ): Promise<void>;
  reset(formId: string, options?: FormResetOptions): void;
  setServerErrors(formId: string, errors: ServerFieldErrors, formErrors?: readonly string[]): void;
  destroy(): void;
}

export const DEFAULT_FORM_STORE_KEY = "form";

export type FormAlpine = Alpine;
export type FormPluginCallback = (alpine: Alpine) => void;

export type FormControllerOptions = {
  /** Instance id. Generated when absent. */
  readonly id?: string;
};
