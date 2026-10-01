/** Stable coded errors shared by every toolkit package. */

/** Registration kinds tracked by the guard helpers. */
export type RegistrationKind = "store" | "magic" | "directive";

/**
 * Base error for the toolkit. Carries a stable machine-readable `code`
 * alongside the human-readable message, plus an optional `cause`.
 */
export class ToolkitError extends Error {
  /** Stable machine-readable code (e.g. `REGISTRATION_COLLISION`). */
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ToolkitError";
    this.code = code;
  }
}

/** Build the human-readable collision message in one place. */
function collisionMessage(
  kind: RegistrationKind,
  name: string,
  packageName: string,
  existingPackageName?: string
): string {
  const owner = existingPackageName ? ` owned by "${existingPackageName}"` : "";
  return `${kind} "${name}" collision: "${packageName}"${owner} (use { override: true })`;
}
/**
 * Thrown when two packages register the same Alpine store, magic, or
 * directive without an explicit `override`. Carries the colliding
 * registration so callers can report which packages conflict.
 */
export class RegistrationError extends ToolkitError {
  /** Which Alpine registry collided: store, magic, or directive. */
  readonly kind: RegistrationKind;
  /** The colliding registration name (without `x-`/`$` prefixes). */
  readonly registrationName: string;
  /** The package that attempted the colliding registration. */
  readonly packageName: string;
  /** The package that already owns the registration, when known. */
  readonly existingPackageName?: string;

  constructor(
    kind: RegistrationKind,
    registrationName: string,
    packageName: string,
    existingPackageName?: string
  ) {
    super(
      "REGISTRATION_COLLISION",
      collisionMessage(kind, registrationName, packageName, existingPackageName)
    );
    this.name = "RegistrationError";
    this.kind = kind;
    this.registrationName = registrationName;
    this.packageName = packageName;
    this.existingPackageName = existingPackageName;
  }
}
