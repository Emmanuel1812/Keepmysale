import { describe, expect, it } from "vitest";
import {
  alternativeOptions,
  isDecline,
  isInStock,
  isSizeReason,
  matchChoice,
  offerMessage,
  pickLineItem,
  sizeReason,
  type VariantInfo,
} from "@/lib/automation/exchange";

const v = (id: string, title: string, qty: number | null, managed = "shopify", policy = "deny"): VariantInfo => ({
  id, title, options: title.split(" / "), inventoryQuantity: qty, inventoryManagement: managed, inventoryPolicy: policy,
});

describe("reason", () => {
  it.each(["De jas is te klein", "Past niet, kan ik een maat groter?", "It is too big", "doesn't fit"])("size: %s", (t) =>
    expect(isSizeReason(t)).toBe(true),
  );
  it.each(["Het is kapot aangekomen", "Ik vind de kleur niet mooi", "I changed my mind"])("not size: %s", (t) =>
    expect(isSizeReason(t)).toBe(false),
  );
  it("direction", () => {
    expect(sizeReason("te klein")).toBe("SIZE_TOO_SMALL");
    expect(sizeReason("veel te groot")).toBe("SIZE_TOO_LARGE");
    expect(sizeReason("andere maat graag")).toBe("OTHER");
  });
});

describe("stock and options", () => {
  it("counts untracked and continue-selling variants as available", () => {
    expect(isInStock(v("1", "S", 0))).toBe(false);
    expect(isInStock(v("1", "S", 3))).toBe(true);
    expect(isInStock(v("1", "S", 0, "", "deny"))).toBe(true);
    expect(isInStock(v("1", "S", 0, "shopify", "continue"))).toBe(true);
  });

  it("offers the other sizes that are in stock, never the one they have", () => {
    const options = alternativeOptions([v("10", "S", 2), v("11", "M", 0), v("12", "L", 5), v("13", "XL", 1)], "12");
    expect(options.map((o) => o.label)).toEqual(["S", "XL"]);
  });

  it("does not offer the 'Default Title' of a product without sizes", () => {
    expect(alternativeOptions([v("1", "Default Title", 4)], "2")).toEqual([]);
  });
});

describe("which item and which choice", () => {
  it("picks the only item, or the one named", () => {
    const one = [{ title: "Jas", variant_id: 1 }];
    expect(pickLineItem(one, "te klein")).toEqual(one[0]);
    const two = [{ title: "Jas", variant_id: 1 }, { title: "Broek", variant_id: 2 }];
    expect(pickLineItem(two, "de broek is te groot")?.title).toBe("Broek");
    expect(pickLineItem(two, "te groot")).toBeNull();
  });

  it("understands the size the customer names, only when it is unambiguous", () => {
    const options = [{ variantId: "1", label: "S" }, { variantId: "2", label: "M" }, { variantId: "3", label: "XL" }];
    expect(matchChoice("Doe maar maat M", options)?.variantId).toBe("2");
    expect(matchChoice("xl graag", options)?.variantId).toBe("3");
    expect(matchChoice("Ik twijfel tussen S en M", options)).toBeNull();
    expect(matchChoice("Maakt niet uit", options)).toBeNull();
    const shoes = [{ variantId: "41", label: "41" }, { variantId: "42", label: "42" }];
    expect(matchChoice("Doe maar 42", shoes)?.variantId).toBe("42");
  });

  it("recognises 'no exchange, money back'", () => {
    expect(isDecline("Nee, liever mijn geld terug")).toBe(true);
    expect(isDecline("Doe maar M")).toBe(false);
  });
});

describe("offer message", () => {
  it("lists the sizes and keeps the plain return option", () => {
    const text = offerMessage({ lineItem: { title: "Winterjas", variantId: "1", productId: "9", variantTitle: "M" }, options: [{ variantId: "2", label: "L" }] }, "nl");
    expect(text).toMatch(/Winterjas/);
    expect(text).toMatch(/L\./);
    expect(text).toMatch(/volledige aankoopbedrag terug/);
  });
});
