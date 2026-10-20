import { describe, expect, it } from "vitest";
import { replyContext } from "@/lib/gmail/client";

const msg = (from: string, subject: string, messageId: string, references?: string) => ({
  payload: {
    headers: [
      { name: "From", value: from },
      { name: "Subject", value: subject },
      { name: "Message-ID", value: messageId },
      ...(references ? [{ name: "References", value: references }] : []),
    ],
  },
});

const gmailWith = (messages: unknown[]) => ({ users: { threads: { get: async () => ({ data: { messages } }) } } });

describe("replyContext", () => {
  it("answers the customer's last mail in the thread, not our own reply, and keeps the reference chain", async () => {
    const gmail = gmailWith([
      msg("Sanne <sanne@x.nl>", "Kapotte jas ontvangen", "<a1@mail.x.nl>"),
      msg("Shop <support@shop.nl>", "Re: Kapotte jas ontvangen", "<b1@mail.gmail.com>", "<a1@mail.x.nl>"),
      msg("Sanne <sanne@x.nl>", "Re: Kapotte jas ontvangen", "<a2@mail.x.nl>", "<a1@mail.x.nl> <b1@mail.gmail.com>"),
    ]);
    const ctx = await replyContext(gmail, "t1", "support@shop.nl");
    expect(ctx.headers).toEqual({ "In-Reply-To": "<a2@mail.x.nl>", References: "<a1@mail.x.nl> <b1@mail.gmail.com> <a2@mail.x.nl>" });
    expect(ctx.subject).toBe("Re: Kapotte jas ontvangen");
  });

  it("never blocks the send when the thread cannot be read", async () => {
    const broken = { users: { threads: { get: async () => { throw new Error("404"); } } } };
    expect(await replyContext(broken, "t1", "support@shop.nl")).toEqual({ headers: {}, subject: null });
  });
});
