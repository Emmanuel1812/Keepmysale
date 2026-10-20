import { describe, expect, it } from "vitest";
import { EmailFilterService } from "@/lib/services/email-filter";

const db = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) } as never;
const check = (from: string, subject: string) =>
  new EmailFilterService(db).shouldProcessEmail({ id: "1", from, subject, body: "x" }, [], "m1");

describe("inbound filter", () => {
  it("keeps supplier account mail out of the customer inbox", async () => {
    expect((await check("STRATO <service@strato.com>", "Je toegangsgegevens voor de STRATO klantenlogin")).shouldProcess).toBe(false);
    expect((await check("STRATO <order@strato.de>", "Welkom bij STRATO")).shouldProcess).toBe(false);
    expect((await check("x@y.com", "Reset your password")).shouldProcess).toBe(false);
  });

  it("still lets a customer through, including one whose name starts like a blocked word", async () => {
    expect((await check("Sanne <sanne@gmail.com>", "Verkeerde kleur geleverd")).shouldProcess).toBe(true);
    expect((await check("ordelijk.huis@gmail.com", "Waar blijft mijn pakket?")).shouldProcess).toBe(true);
  });
});
