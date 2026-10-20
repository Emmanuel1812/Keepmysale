import { describe, expect, it } from "vitest";
import { orderLabel } from "@/lib/order-label";

describe("orderLabel", () => {
  it("shows exactly one hash for Shopify names that already have one", () => {
    expect(orderLabel("#1001", "abc")).toBe("#1001");
    expect(orderLabel("##1001", "abc")).toBe("#1001");
  });

  it("adds the hash to a bare number", () => {
    expect(orderLabel("1001", "abc")).toBe("#1001");
    expect(orderLabel("EFO-1001", "abc")).toBe("#EFO-1001");
  });

  it("falls back to the start of the internal id when there is no number", () => {
    expect(orderLabel(null, "0123456789abcdef")).toBe("#01234567");
    expect(orderLabel("  ", "0123456789abcdef")).toBe("#01234567");
    expect(orderLabel("#", "0123456789abcdef")).toBe("#01234567");
  });
});
