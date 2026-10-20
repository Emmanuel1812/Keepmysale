import { beforeEach, describe, expect, it, vi } from "vitest";

const findConversation = vi.fn();
const findByConversation = vi.fn();

vi.mock("@/lib/env", () => ({ getEnv: () => ({}) }));
vi.mock("@/services/ai-service", () => ({ AiService: class {} }));
vi.mock("@/services/merchant-service", () => ({
  MerchantService: class {
    findById = async (id: string) => ({ id, settings: {} });
  },
}));
vi.mock("@/services/conversation-service", () => ({
  ConversationService: class {
    findById = findConversation;
  },
}));
vi.mock("@/services/message-service", () => ({
  MessageService: class {
    findByConversation = findByConversation;
  },
}));

import { WebhookService } from "@/services/webhook-service";

describe("processAiResolution ownership", () => {
  beforeEach(() => {
    findConversation.mockReset();
    findByConversation.mockReset();
    findByConversation.mockResolvedValue([]);
  });

  it("treats another merchant's conversation as not found and never reads its messages", async () => {
    findConversation.mockResolvedValue({ id: "c-other", merchantId: "merchant-B", customerId: "u" });
    await expect(new WebhookService({} as never).processAiResolution("c-other", "merchant-A")).rejects.toThrow(
      "Conversation not found",
    );
    expect(findByConversation).not.toHaveBeenCalled();
  });

  it("goes on to read the thread when the conversation is the merchant's own", async () => {
    findConversation.mockResolvedValue({ id: "c-own", merchantId: "merchant-A", customerId: "u" });
    await expect(new WebhookService({} as never).processAiResolution("c-own", "merchant-A")).rejects.toThrow(
      "No customer message found",
    );
    expect(findByConversation).toHaveBeenCalledWith("c-own");
  });
});
