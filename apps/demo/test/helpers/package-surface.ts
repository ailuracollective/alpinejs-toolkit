/**
 * Reads the *real* public surface of a package out of its own source, so a
 * demo page can be checked against what the package actually exports instead
 * of against a hand-written list that drifts.
 *
 * Why the TypeScript compiler and not a regex: the surface of a package is
 * spread across declarations that reference each other in every way TypeScript
 * allows — `interface MediaStore extends MediaSnapshot`, `type TransferMagic =
 * ClipboardMagic & ShareMagic & ExportMagic`, `type GestureStore = { … }`,
 * `type VirtualStore = { … }`. A hand-rolled parser gets three of those four
 * right and silently returns an empty set for the fourth, which would turn the
 * lint into a coin flip. `ts.createProgram` on the package's own entry files
 * resolves all of them, and it is the same resolution the consumer gets.
 *
 * Cost is one program per package, built lazily and cached for the run. These
 * are small files with no runtime dependencies, so it is a few hundred
 * milliseconds in total and it buys an answer that cannot be stale.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

import ts from "typescript";

const PACKAGES_ROOT = resolve(import.meta.dirname, "../../../../packages");

export { PACKAGES_ROOT };

/** Every package folder, sorted so the program's root order is deterministic. */
function collectPackageFolders(): string[] {
  try {
    return readdirSync(PACKAGES_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Packages whose public surface does not resolve to a `*Store`/`*Magic`
 * declaration reachable from `src/types.ts`, because they are not stores at
 * all: `child` is a directive, `core` is the substrate every controller is
 * built on (its demos reference it by function name in code blocks that never
 * execute), and `json-api` hands back a client class rather than registering a
 * store. `state-machine` is the odd one — `$machine` exists, but its type is
 * generic over the caller's own state and event unions, so the useful surface
 * is the *handle* (`ScopedMachineHandle`), not a store.
 *
 * Listing a package here is a deliberate claim that its demos are checked
 * against this list instead, so each entry is short and each is reviewable.
 */
export const SURFACE_OVERRIDES: Record<string, readonly string[]> = {
  child: [],
  // The three query adapters register a store that belongs to `query` — the
  // surface they would be checked against is another package's — and none of
  // them declares a `*Store`/`*Magic` of its own, so each of their pages is
  // checked through the delegated `Alpine.data` component that calls it.
  "query-adapter-alpine": [],
  "query-adapter-nanostores": [],
  "query-adapter-zustand": [],
  core: [
    "guardStore",
    "guardMagic",
    "guardDirective",
    "safeWindow",
    "safeDocument",
    "safeEvent",
    "isBrowser",
    "raf",
    "cancelRaf",
    "throttle",
    "debounce",
    "clamp",
    "createEvent",
  ],
  "json-api": [
    "findAll",
    "findOne",
    "create",
    "update",
    "delete",
    "on",
    "request",
    "baseUrl",
    "schema",
  ],
  "state-machine": [
    "state",
    "value",
    "context",
    "send",
    "can",
    "cannot",
    "is",
    "matches",
    "reset",
    "states",
    "events",
    "subscribe",
  ],
};

/** Names the demo lint treats as a public surface: the store and the magic. */
function isSurfaceDeclaration(name: string): boolean {
  return name.endsWith("Store") || name.endsWith("Magic");
}

/**
 * The registry a demo is checked against: which store key, magic key and
 * directive key each package claims, and which member names are reachable on
 * it.
 *
 * Ownership is what makes the check worth running. "Is this member name found
 * in *some* package" is nearly useless — between 35 packages almost every name
 * matches something. "Is this member a member of the surface of the package
 * that owns the store it was read from" is the claim a demo actually makes, and
 * it is exactly the claim that silently breaks when a package renames or drops
 * something.
 */
export interface PackageRegistry {
  /** `$store.<key>` → the packages that may own it (two packages can share a key). */
  stores: Map<string, string[]>;
  /** `$.<key>` → the owning packages. */
  magics: Map<string, string[]>;
  /** `x-<key>` → the owning packages. */
  directives: Map<string, string[]>;
  /** package folder → union of its `*Store`/`*Magic` member names. */
  surfaces: Map<string, ReadonlySet<string>>;
}

/**
 * The constant names that declare a registry key. Every package follows the
 * `DEFAULT_<PACKAGE>_<KIND>_KEY = "<key>"` convention, with the three
 * attention/transfer magics predating it: they are named per-magic rather than
 * per-package because those packages register more than one.
 *
 * `env` no longer needs an entry here — its `DEFAULT_ENV_MAGIC_KEY` follows the
 * convention like every other package, which is what R-INST-22 asks for. What
 * makes this regex able to find the keys at all is the suffix; a constant named
 * `DEFAULT_<PACKAGE>_KEY` is invisible to it, and a package could silently
 * register a key this registry never learns about.
 */
const REGISTRY_CONSTANT = /DEFAULT_([A-Z_]+?)_(STORE|MAGIC|DIRECTIVE)_KEY = "([a-zA-Z][\w-]*)"/g;
const LEGACY_REGISTRY_CONSTANT =
  /DEFAULT_(ATTENTION_WAKELOCK_KEY|ATTENTION_IDLE_KEY|TRANSFER_CLIPBOARD_KEY|TRANSFER_SHARE_KEY|TRANSFER_EXPORT_KEY) = "([a-zA-Z][\w-]*)"/g;

const REGISTRY_CACHE = new Map<string, PackageRegistry>();

/** The whole registry, derived from the packages and cached for the run. */
export function getPackageRegistry(): PackageRegistry {
  const cached = REGISTRY_CACHE.get("registry");
  if (cached) return cached;

  const stores = new Map<string, string[]>();
  const magics = new Map<string, string[]>();
  const directives = new Map<string, string[]>();
  const surfaces = new Map<string, ReadonlySet<string>>();

  const add = (target: Map<string, string[]>, key: string, folder: string) => {
    const owners = target.get(key);
    if (owners) {
      if (!owners.includes(folder)) owners.push(folder);
    } else {
      target.set(key, [folder]);
    }
  };

  for (const folder of collectPackageFolders()) {
    surfaces.set(folder, getPackageSurface(folder));
    for (const source of sourceTextsFor(folder)) {
      for (const [, , kind, key] of source.matchAll(REGISTRY_CONSTANT)) {
        add(
          kind === "STORE" ? stores : kind === "MAGIC" ? magics : directives,
          key as string,
          folder
        );
      }
      for (const [, , key] of source.matchAll(LEGACY_REGISTRY_CONSTANT)) {
        add(magics, key as string, folder);
      }
    }
  }

  const registry: PackageRegistry = { stores, magics, directives, surfaces };
  REGISTRY_CACHE.set("registry", registry);
  return registry;
}

/**
 * Members reachable on anything owned by `owners`. Empty when a key has no
 * owner the lint recognises, which the caller reports rather than swallows.
 */
export function membersFor(
  registry: PackageRegistry,
  owners: string[] | undefined
): ReadonlySet<string> {
  const members = new Set<string>();
  for (const folder of owners ?? []) {
    for (const name of registry.surfaces.get(folder) ?? []) members.add(name);
  }
  return members;
}

let shared: { program: ts.Program; sourcesByPackage: Map<string, ts.SourceFile[]> } | undefined;

/**
 * One program for every package, built once.
 *
 * A program per package was correct and cost ~8s, almost all of it re-parsing
 * `lib.d.ts` 35 times. The packages are independent, so a single program with
 * all 35 entries as roots resolves them all and pays that cost once.
 */
function sharedProgram():
  | { program: ts.Program; sourcesByPackage: Map<string, ts.SourceFile[]> }
  | undefined {
  if (shared) return shared;
  const entries = collectPackageFolders()
    .map((folder) => join(PACKAGES_ROOT, folder, "src/index.ts"))
    .filter((entry) => existsSync(entry));
  if (entries.length === 0) return undefined;

  const program = ts.createProgram(entries, {
    noEmit: true,
    skipLibCheck: true,
    skipDefaultLibCheck: true,
    allowJs: false,
    types: [],
    strict: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  });

  const sourcesByPackage = new Map<string, ts.SourceFile[]>();
  for (const folder of collectPackageFolders()) {
    const prefix = join(PACKAGES_ROOT, folder, "src") + sep;
    sourcesByPackage.set(
      folder,
      program.getSourceFiles().filter((file) => file.fileName.startsWith(prefix))
    );
  }
  shared = { program, sourcesByPackage };
  return shared;
}

const surfaceCache = new Map<string, ReadonlySet<string>>();
const declaredCache = new Map<string, ReadonlySet<string>>();

/**
 * Every public member name of `folder`, unioned across its `*Store` and
 * `*Magic` declarations plus {@link SURFACE_OVERRIDES}.
 *
 * A package with no resolvable declarations and no override yields an empty
 * set on purpose. An empty set makes the lint report every reference as
 * invented, which is the failure that gets noticed; the opposite — quietly
 * skipping the package — is the one that ships a broken demo.
 */
export function getPackageSurface(folder: string): ReadonlySet<string> {
  const cached = surfaceCache.get(folder);
  if (cached) return cached;

  const declared = new Set<string>();
  const surface = new Set<string>(SURFACE_OVERRIDES[folder] ?? []);
  const built = sharedProgram();
  if (built) {
    const checker = built.program.getTypeChecker();
    for (const source of built.sourcesByPackage.get(folder) ?? []) {
      for (const statement of source.statements) {
        if (!ts.isInterfaceDeclaration(statement) && !ts.isTypeAliasDeclaration(statement))
          continue;
        if (!isSurfaceDeclaration(statement.name.text)) continue;
        const type = checker.getTypeAtLocation(statement.name);
        for (const property of checker.getPropertiesOfType(type)) {
          declared.add(property.getName());
          surface.add(property.getName());
        }
        // A callable magic (`$timer(options)`) has no properties of its own:
        // its surface is whatever the call returns. Reading only the properties
        // made such a package look surfaceless, which is the one failure the
        // caller above is designed to report rather than hide.
        for (const signature of type.getCallSignatures()) {
          for (const property of checker.getPropertiesOfType(signature.getReturnType())) {
            declared.add(property.getName());
            surface.add(property.getName());
          }
        }
      }
    }
  }

  declaredCache.set(folder, declared);
  surfaceCache.set(folder, surface);
  return surface;
}

/**
 * True when a package's surface came from its own declarations rather than
 * from {@link SURFACE_OVERRIDES}. Used by the lint's self-check: a package that
 * silently stopped declaring a surface would otherwise look identical to one
 * that never had one.
 */
export function hasDeclaredSurface(folder: string): boolean {
  getPackageSurface(folder);
  return (declaredCache.get(folder)?.size ?? 0) > 0;
}

/** Raw text of every source file in a package, for the registry constants. */
function sourceTextsFor(folder: string): string[] {
  const root = join(PACKAGES_ROOT, folder, "src");
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".ts")) files.push(path);
    }
  };
  try {
    walk(root);
  } catch {
    return [];
  }
  return files.map((path) => readFileSync(path, "utf8"));
}
