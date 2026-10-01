/**
 * Consult a plugin by running it, not by reading it.
 *
 * Reading `types.ts` tells you what someone declared. Importing the built plugin,
 * registering it against a real Alpine in the project's own test DOM, and dumping
 * what the store and magics actually expose tells you what a user gets. The two
 * disagree — overlay's documented `open()`/`close()` do not exist at runtime.
 *
 * Usage: node probe.mjs <packageName> [<packageName> ...]
 */
import { Window } from "happy-dom";

const win = new Window({ url: "https://example.test" });
for (const key of [
  "window",
  "document",
  "navigator",
  "location",
  "history",
  "HTMLElement",
  "Element",
  "Node",
  "CustomEvent",
  "Event",
  "MutationObserver",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "getComputedStyle",
  "matchMedia",
  "localStorage",
  "sessionStorage",
  "NodeFilter",
  "DocumentFragment",
  "SVGElement",
  "Text",
  "ShadowRoot",
  "AbortController",
  "IntersectionObserver",
  "ResizeObserver",
]) {
  if (win[key] === undefined) continue;
  // some globals (navigator) are getter-only on globalThis
  try {
    globalThis[key] = win[key];
  } catch {
    Object.defineProperty(globalThis, key, { value: win[key], configurable: true, writable: true });
  }
}
globalThis.self = globalThis;

// imported after the DOM globals exist
const { default: Alpine } = await import("alpinejs");

const names = process.argv.slice(2);
if (!names.length) {
  console.error("usage: node probe.mjs <packageName> [...]");
  process.exit(1);
}

const kebabToCamel = (s) => s.replace(/-(\w)/g, (_, c) => c.toUpperCase());

/** "a(), b() props: c" for an arbitrary object, walking the prototype chain. */
function describe(value) {
  const methods = [];
  const props = [];
  let node = value;
  while (node && node !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(node)) {
      if (name === "constructor") continue;
      const d = Object.getOwnPropertyDescriptor(node, name);
      if (!d) continue;
      if (typeof d.value === "function") methods.push(`${name}()`);
      else props.push(name);
    }
    node = Object.getPrototypeOf(node);
  }
  const head = [...new Set(methods)].sort().join(", ") || "(sin metodos)";
  return props.length ? `${head} props: ${[...new Set(props)].sort().join(", ")}` : head;
}

for (const name of names) {
  console.log(`\n${"=".repeat(72)}\n${name}`);

  let mod;
  try {
    mod = await import(`../packages/${name}/dist/index.mjs`);
  } catch (e) {
    console.log(`  NO SE PUDO IMPORTAR: ${e.message}`);
    continue;
  }

  console.log(`  exports: ${Object.keys(mod).join(", ")}`);

  const factory =
    mod[`${kebabToCamel(name)}Plugin`] ||
    mod.default ||
    Object.keys(mod).find((k) => k.endsWith("Plugin") && typeof mod[k] === "function");

  if (typeof factory !== "function") {
    console.log("  sin factory de plugin recognizable");
    continue;
  }
  console.log(`  factory: ${factory.name || "(anon)"}`);

  // a real element so Alpine can actually mount
  document.body.innerHTML = `<div id="probe" x-data="{ gid: 'g' }"></div>`;

  // recorder used both for the plugin callback and for registration functions
  const early = {};
  const fakeAlpineScaffold = {
    $data: (o) => o,
    reactive: Alpine.reactive,
    effect: Alpine.effect,
    store: (name, ...rest) => {
      if (rest.length) early[name] = rest[0];
      return early[name];
    },
    magic: (name, fn) => {
      early[`$${name}`] = fn;
    },
    directive: (name, fn) => {
      early[`x-${name}`] = fn;
    },
  };

  // Some factories require options (state-machine wants a machine config,
  // json-api wants a schema + baseUrl). Retry with a minimal config so their
  // surface can be captured too.
  const optionAttempts = [
    {},
    { schema: {}, baseUrl: "https://api.test" },
    { initial: "idle", transitions: [] },
  ];
  let callback;
  for (const opts of optionAttempts) {
    try {
      callback = factory(opts);
      if (typeof callback === "function") break;
    } catch (e) {
      callback = undefined;
      var lastErr = e;
    }
  }
  if (typeof callback !== "function") {
    // Not every package is an Alpine plugin. `stateMachine(Alpine, options)`
    // registers its magic directly and returns nothing, so try that shape too.
    let registered = false;
    for (const opts of optionAttempts) {
      try {
        factory(fakeAlpineScaffold, opts);
        registered = true;
        break;
      } catch {
        registered = false;
      }
    }
    if (registered) {
      const magics = Object.keys(early).filter((k) => k.startsWith("$"));
      const stores = Object.keys(early).filter((k) => !k.startsWith("$") && !k.startsWith("x-"));
      const dirs = Object.keys(early).filter((k) => k.startsWith("x-"));
      console.log(`  forma: funcion de registro (no es un plugin de Alpine)`);
      console.log(`  magics:     ${magics.join(", ") || "(ninguno)"}`);
      console.log(`  stores:     ${stores.join(", ") || "(ninguno)"}`);
      console.log(`  directives: ${dirs.join(", ") || "(ninguna)"}`);
      continue;
    }
    console.log(`  factory() Lanzo: ${lastErr ? lastErr.message : "sin callback"}`);
    continue;
  }
  if (typeof callback !== "function") {
    console.log(`  factory() devolvio ${typeof callback}, no un callback`);
    continue;
  }

  // capture what the plugin registers, without booting a full Alpine tree
  const captured = {};
  const fakeAlpine = {
    ...Alpine,
    $data: (o) => o,
    reactive: Alpine.reactive,
    effect: Alpine.effect,
    // guardStore finishes with `alpine.store(name)` as a getter, so only capture
    // when a value is actually being registered, and answer the getter form.
    store: (name, ...rest) => {
      if (rest.length) captured[name] = rest[0];
      return captured[name];
    },
    directive: (name, fn) => {
      captured[`x-${name}`] = fn;
    },
    magic: (name, fn) => {
      captured[`$${name}`] = fn;
    },
  };

  try {
    await callback(fakeAlpine, { gid: "g" });
  } catch (e) {
    console.log(`  el callback lanzo: ${e.message}`);
  }

  const stores = Object.entries(captured).filter(
    ([k]) => !k.startsWith("x-") && !k.startsWith("$")
  );
  if (stores.length) {
    for (const [key, value] of stores) {
      // Some packages return a class instance from toStore(), so the methods live
      // on the prototype and Object.keys() sees nothing.
      // Methods and reactive data properties are both part of the surface. Only
      // reporting functions makes `$store.calendar.month` look like it does not
      // exist, which is a false positive in the audit that follows.
      const methods = new Set();
      const props = new Set();
      let node = value;
      while (node && node !== Object.prototype) {
        for (const name of Object.getOwnPropertyNames(node)) {
          if (name === "constructor") continue;
          const d = Object.getOwnPropertyDescriptor(node, name);
          if (!d) continue;
          if (typeof d.value === "function") methods.add(name);
          else if (d.get) {
            // a getter is reactive state, unless it is a method-shaped factory
            methods.has(name) ? methods.add(name) : props.add(name);
          } else props.add(name);
        }
        node = Object.getPrototypeOf(node);
      }
      console.log(
        `  $store.${key}: ${[...methods]
          .sort()
          .map((m) => `${m}()`)
          .join(", ")}`
      );
      if (props.size) console.log(`  $store.${key} props: ${[...props].sort().join(", ")}`);
    }
  }
  // Invoke each magic callback: the object it returns IS the magic's documented
  // surface, and without this every magic's methods go unchecked.
  const el = document.getElementById("probe");
  for (const key of Object.keys(captured).filter((k) => k.startsWith("$"))) {
    const fn = captured[key];
    try {
      const value = fn(el, { cleanup: () => {}, effect: () => {} });
      if (value && typeof value === "object") {
        // Expand factory methods one level: $timer.countdown() and
        // $machine({...}) return an object that IS part of the documented
        // surface.
        for (const mname of Object.getOwnPropertyNames(value)) {
          if (mname === "constructor") continue;
          const fn = value[mname];
          if (typeof fn !== "function" || fn.length > 1) continue;
          for (const arg of [undefined, 1000, {}, { states: { on: "on", off: "off" } }]) {
            try {
              const sub = fn.call(value, ...(arg === undefined ? [] : [arg]));
              if (sub && typeof sub === "object" && Object.keys(sub).length) {
                console.log(`  ${key}.${mname}() returns: ${describe(sub)}`);
                break;
              }
            } catch {
              /* wrong arity or needs real DOM; skip */
            }
          }
        }
        const methods = [];
        const props = [];
        let node = value;
        while (node && node !== Object.prototype) {
          for (const name of Object.getOwnPropertyNames(node)) {
            if (name === "constructor") continue;
            const d = Object.getOwnPropertyDescriptor(node, name);
            if (!d) continue;
            if (typeof d.value === "function") methods.push(`${name}()`);
            else if (d.get) props.push(name);
            else props.push(name);
          }
          node = Object.getPrototypeOf(node);
        }
        console.log(`  ${key}: ${[...new Set(methods)].sort().join(", ") || "(sin metodos)"}`);
        if (props.length) console.log(`  ${key} props: ${[...new Set(props)].sort().join(", ")}`);
      } else if (typeof value === "function") {
        // A function magic can also be a factory: $machine({...}) returns the
        // documented control object, so expand it too.
        for (const arg of [
          { states: { on: "on", off: "off" } },
          { states: { on: "on", off: "off" }, initial: "on" },
        ]) {
          try {
            const sub = value(arg);
            if (sub && typeof sub === "object" && Object.keys(sub).length) {
              console.log(`  ${key}(...) returns: ${describe(sub)}`);
              break;
            }
          } catch {
            /* not a factory */
          }
        }
        // A magic can be a function carrying statics, e.g. $share.isSupported.
        // Without listing them, the audit cannot tell a static from a typo.
        // Statics that are themselves functions belong in the surface too:
        // $share.canShare is callable, and hiding it makes it unverifiable.
        const props = [];
        const statics = [];
        for (const n of Object.getOwnPropertyNames(value)) {
          if (n === "length" || n === "name") continue;
          if (typeof value[n] === "function") statics.push(`${n}()`);
          else props.push(n);
        }
        console.log(`  ${key}: function(${value.length})`);
        if (props.length) console.log(`  ${key} props: ${props.sort().join(", ")}`);
        if (statics.length) console.log(`  ${key} statics: ${statics.sort().join(", ")}`);
      } else {
        // An opaque browser object, e.g. $battery is a BatteryManager.
        console.log(`  ${key}: ${typeof value} (objeto de la plataforma)`);
      }
    } catch (e) {
      console.log(`  ${key}: no invocable (${e.message})`);
    }
  }
  const magics = Object.keys(captured).filter((k) => k.startsWith("$"));
  const directives = Object.keys(captured).filter((k) => k.startsWith("x-"));
  console.log(`  directives: ${directives.join(", ") || "(ninguna)"}`);
  void magics;
}
