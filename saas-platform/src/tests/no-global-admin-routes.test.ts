import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// /api/admin/cleanup deleted conversations of EVERY merchant by subject keyword ("Subscription", "Verify your"...)
// behind a secret in the URL. It was a one-off clean-up of the test mailbox; it must not come back.
describe("one-off global admin routes", () => {
  it("the cross-merchant cleanup endpoint does not exist", () => {
    expect(existsSync(path.join(process.cwd(), "src/app/api/admin/cleanup/route.ts"))).toBe(false);
  });
});
