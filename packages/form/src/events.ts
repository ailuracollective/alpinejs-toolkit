export type FormChangeSource =
  | "initialization"
  | "register"
  | "value"
  | "touch"
  | "validate"
  | "submit"
  | "reset"
  | "server-error";

export interface FormChangeDetail {
  readonly formId: string;
  readonly source: FormChangeSource;
  readonly fieldPath?: string;
}

export interface FormEvents extends Record<string, unknown[]> {
  change: [FormChangeDetail];
  submit: [{ formId: string; values: Readonly<Record<string, unknown>> }];
  "submit-error": [{ formId: string; error: unknown }];
}
