import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { APP_BRIDGE_LOADER, APP_BRIDGE_SRC } from "@/lib/shopify/app-bridge-loader";

// Runs the real inline script against a fake window: no browser, no network.
function run(framed: boolean) {
  const written: string[] = [];
  const top = {};
  const win: Record<string, unknown> = { top };
  win.self = framed ? {} : top; // framed: self !== top
  const context = vm.createContext({ window: win, document: { write: (html: string) => written.push(html) } });
  vm.runInContext(APP_BRIDGE_LOADER, context);
  return written;
}

describe("App Bridge is loaded only inside the Shopify admin iframe", () => {
  it("framed: writes one blocking script tag pointing at Shopify's CDN", () => {
    const written = run(true);
    expect(written).toHaveLength(1);
    expect(written[0]).toBe(`<script src="${APP_BRIDGE_SRC}"></script>`);
    expect(written[0]).not.toMatch(/async|defer|module/);
  });

  it("top-level (standalone keepmysale.com): writes nothing, so it can never bounce to Shopify", () => {
    expect(run(false)).toEqual([]);
  });

  it("never throws when the top window cannot be read", () => {
    const context = vm.createContext({
      window: { get top() { throw new Error("cross-origin"); }, self: {} },
      document: { write: () => undefined },
    });
    expect(() => vm.runInContext(APP_BRIDGE_LOADER, context)).not.toThrow();
  });
});
