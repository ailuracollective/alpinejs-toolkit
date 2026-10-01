import accordion from "@ailura/alpinejs-accordion";
import attention from "@ailura/alpinejs-attention";
import calendar from "@ailura/alpinejs-calendar";
import carousel from "@ailura/alpinejs-carousel";
import child from "@ailura/alpinejs-child";
import collection from "@ailura/alpinejs-collection";
import command from "@ailura/alpinejs-command";
import dialog from "@ailura/alpinejs-dialog";
import env from "@ailura/alpinejs-env";
import form from "@ailura/alpinejs-form";
import geo from "@ailura/alpinejs-geo";
import gesture from "@ailura/alpinejs-gesture";
import history from "@ailura/alpinejs-history";
import jsonApi from "@ailura/alpinejs-json-api";
import keyboard from "@ailura/alpinejs-keyboard";
import lang from "@ailura/alpinejs-lang";
import media, { type MediaIntervals } from "@ailura/alpinejs-media";
import menu from "@ailura/alpinejs-menu";
import notify from "@ailura/alpinejs-notify";
import overlay from "@ailura/alpinejs-overlay";
import permissions from "@ailura/alpinejs-permissions";
import { queryPlugin } from "@ailura/alpinejs-query";
import query from "@ailura/alpinejs-query-adapter-alpine";
import queryNanostores from "@ailura/alpinejs-query-adapter-nanostores";
import queryZustand from "@ailura/alpinejs-query-adapter-zustand";
import scroll from "@ailura/alpinejs-scroll";
import selection from "@ailura/alpinejs-selection";
import sidebar from "@ailura/alpinejs-sidebar";
import stateMachine from "@ailura/alpinejs-state-machine";
import tabs from "@ailura/alpinejs-tabs";
import theme from "@ailura/alpinejs-theme";
import timer from "@ailura/alpinejs-timer";
import toast from "@ailura/alpinejs-toast";
import tooltip from "@ailura/alpinejs-tooltip";
import transfer from "@ailura/alpinejs-transfer";
import virtual from "@ailura/alpinejs-virtual";
import anchor from "@alpinejs/anchor";
import collapse from "@alpinejs/collapse";
import morph from "@alpinejs/morph";
import persist from "@alpinejs/persist";
import alpine from "alpinejs";

import { registerDemoDataModules } from "./demo/demo-data-registration.js";
import { jsonApiDemoOptions } from "./demo/json-api-demo.js";
import { playgroundPermissionAdapters } from "./demo/permission-adapters.js";
import { createAlpineDemoAdapter, QUERY_ALPINE_STORE_KEY } from "./demo/query-alpine-demo.js";
import {
  createNanostoresDemoAdapter,
  QUERY_NANOSTORES_STORE_KEY,
} from "./demo/query-nanostores-demo.js";
import { createZustandDemoAdapter, QUERY_ZUSTAND_STORE_KEY } from "./demo/query-zustand-demo.js";

/**
 * The three breakpoints the playground chrome is built on. Values are
 * min-widths: `$store.media.breakpoint` reports the last interval the
 * viewport has reached.
 */
const mediaIntervals: MediaIntervals = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
};

export async function startAlpineDemo(): Promise<void> {
  if (window.Alpine) {
    return;
  }

  // Alpine's own companion plugins — the demos use them for persistence,
  // anchoring and morphing, not the toolkit.
  alpine.plugin([persist, anchor, collapse, morph]);

  // The `$machine` magic every feature controller is built on.
  // `stateMachine` is a factory: it returns the `Alpine.plugin()` callback,
  // so it has to be called, not passed. Passing it directly would register
  // nothing and `$machine` would silently be undefined.
  alpine.plugin(stateMachine());

  alpine.plugin([
    permissions({ adapters: playgroundPermissionAdapters }),
    keyboard({
      options: { pauseWhileScopesActive: ["modal"] },
    }),
    toast({ maxToasts: 5, maxVisible: 3 }),
    env(),
    gesture(),
    history(),
    transfer(),
    tooltip(),
    tabs(),
    accordion(),
    carousel(),
    virtual(),
    selection(),
    collection(),
    calendar(),
    attention(),
    geo(),
    // The plugin has always been able to register a service worker; the demo
    // just never passed the URL, so `public/notify-sw.js` sat unregistered and
    // iOS notifications could not work even from a Home Screen install. iOS
    // 16.4+ requires a registered service worker with a push handler, and
    // `notify-sw.js` now has one.
    notify({ serviceWorkerUrl: "/notify-sw.js" }),
    query(),
    form(),
    timer(),
    // The playground navigates with Astro view transitions: each swap replaces
    // the `<html>` element, so the server-rendered class (always "light") lands
    // again. `reapplyEvents` is the package's hook for exactly that — the
    // controller re-applies its stored resolved theme after every swap.
    theme({ reapplyEvents: ["astro:after-swap"] }),
    media({ intervals: mediaIntervals }),
    scroll(),
    overlay(),
    child(),
    lang(),
  ]);

  // Packages that compose with the scroll store are registered after it.
  const scrollStore = alpine.store("scroll");

  alpine.plugin([
    sidebar({
      closeOnEscape: true,
      breakpoint: {
        query: "(max-width: 1023px)",
        onMismatch: "hide",
      },
    }),
    dialog(),
    menu({ scroll: scrollStore }),
    command(),
  ]);

  alpine.plugin(jsonApi(jsonApiDemoOptions));

  // A fourth query cache, the one this adapter package's reactive half is for.
  // The package's own plugin above registers `"query"` and cannot produce the
  // box at all — `createQueryPlugin()` builds its controller with no adapter
  // and never receives the Alpine instance at factory time — so the demo asks
  // for its own key and wires `createAlpineStoreAdapter` into `queryPlugin()`
  // instead, which is the call the package's README documents. The adapter is
  // wrapped so the box stays reachable: the handle `create()` returns has
  // `get`/`set`/`destroy` and no `subscribe`, so a template bound to it is the
  // only observer there is. See `src/demo/query-alpine-demo.ts`.
  alpine.plugin(
    queryPlugin({
      storeKey: QUERY_ALPINE_STORE_KEY,
      adapter: createAlpineDemoAdapter(alpine),
    })
  );

  // A third query cache, backed by `zustand/vanilla`, registered under its own
  // key: the alpine adapter already holds `"query"` and `guardStore()` throws
  // on a duplicate rather than replacing it, so the demo asks for `queryZustand`
  // and both caches coexist. The adapter is built with an injected `create` so
  // the stores stay reachable — that is what the zustand demo page subscribes
  // to. See `src/demo/query-zustand-demo.ts`.
  alpine.plugin(
    queryZustand({
      storeKey: QUERY_ZUSTAND_STORE_KEY,
      adapter: createZustandDemoAdapter(),
    })
  );

  // A fourth query cache, backed by a nanostores `atom`, registered under its own
  // key for the same reason as `queryZustand` above: `guardStore()` throws on a
  // duplicate, so every adapter demo asks for a key of its own and all three
  // coexist. The adapter is built with an injected `create` so the atoms stay
  // reachable — that is what the nanostores demo page subscribes to, and it is
  // the only way to get at them, because the handle `create()` returns has no
  // `subscribe` of its own. See `src/demo/query-nanostores-demo.ts`.
  alpine.plugin(
    queryNanostores({
      storeKey: QUERY_NANOSTORES_STORE_KEY,
      adapter: createNanostoresDemoAdapter(),
    })
  );

  await document.fonts.ready;
  registerDemoDataModules(alpine);
  window.Alpine = alpine;
  alpine.start();
}
