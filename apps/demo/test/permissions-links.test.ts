// @vitest-environment happy-dom
/**
 * The permissions registry reaches the Alpine scope.
 *
 * The demo shipped `x-data={JSON.stringify(capabilityLinks)}`, which spreads
 * the registry AS the data object: the scope then held `notifications`,
 * `geolocation` and `screen-wake-lock` as top-level keys, and there was no
 * `capabilityLinks` key at all. Every row then threw "capabilityLinks is not
 * defined" — twice per row, per page load, on every page rendering the section.
 *
 * This mounts the real bindings against real Alpine, which is what the static
 * guard in `template-scopes.test.ts` cannot do: only evaluation proves the
 * expression resolves.
 */
import Alpine from "alpinejs";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

const registry = {
  notifications: { plugin: "notify", href: "/notify/" },
  geolocation: { plugin: "geo", href: "/geo/" },
};

/** The two bindings from the demo row, inside its `x-for`. */
function markup(dataExpression: unknown): string {
  const el = document.createElement("div");
  el.innerHTML = `
    <div class="space-y-4 text-sm" x-data='${JSON.stringify(dataExpression)}'>
      <template x-for="name in ['notifications', 'geolocation']" :key="name">
        <div>
          <a class="underline" :href="capabilityLinks[name]?.href">go</a>
          <code x-text="capabilityLinks[name]?.plugin"></code>
        </div>
      </template>
    </div>
  `;
  return el.innerHTML;
}

const rendered = async (): Promise<Element> => {
  const host = document.createElement("div");
  host.innerHTML = markup({ capabilityLinks: registry });
  document.body.append(host);
  Alpine.initTree(host);
  await Alpine.nextTick();
  await Alpine.nextTick();
  return host;
};

beforeAll(() => {
  Alpine.start();
});

afterAll(() => {
  document.body.replaceChildren();
});

describe("permissions capability links", () => {
  it("resolve for every row when the registry is a named key", async () => {
    const host = await rendered();
    const codes = [...host.querySelectorAll("code")].map((c) => c.textContent);
    const hrefs = [...host.querySelectorAll("a")].map((a) => a.getAttribute("href"));

    expect(codes).toEqual(["notify", "geo"]);
    expect(hrefs).toEqual(["/notify/", "/geo/"]);
  });

  it("the spread form is what threw", async () => {
    // What the demo shipped: the registry IS the data object, so
    // `capabilityLinks` does not exist. Every row raised an expression error and
    // rendered nothing.
    //
    // Alpine's default handler logs and then RE-THROWS on a `setTimeout`, so
    // leaving it installed would fail the whole run with unhandled errors. The
    // handler is swapped for one that records, which also lets this assert the
    // error rather than merely the empty result.
    const reported: string[] = [];
    const setErrorHandler = (
      Alpine as unknown as {
        setErrorHandler: (h: (e: Error) => void) => void;
      }
    ).setErrorHandler;
    setErrorHandler((error: Error) => {
      reported.push(error.message);
    });

    const el = document.createElement("div");
    el.innerHTML = markup(registry);
    document.body.append(el);
    try {
      Alpine.initTree(el);
      await Alpine.nextTick();
      await Alpine.nextTick();

      expect(reported.some((m) => m.includes("capabilityLinks"))).toBe(true);
      expect([...el.querySelectorAll("code")].map((c) => c.textContent)).not.toContain("notify");
    } finally {
      el.remove();
    }
  });
});
