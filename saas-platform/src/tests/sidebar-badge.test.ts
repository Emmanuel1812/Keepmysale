import { describe, expect, it, vi } from "vitest";

const log: string[] = [];

vi.mock("@/lib/auth", () => ({ getMerchantFromSession: async () => ({ id: "m1", shopName: "Test Shop" }) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServiceClient: () => ({}) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/app/logo.png", () => ({ default: { src: "/logo.png", width: 1, height: 1 } }));
vi.mock("@/components/layout/nav-item", () => ({ NavItem: () => null }));
vi.mock("@/dal/conversations", () => ({
  ConversationsDal: class {
    async findByMerchant() {
      log.push("conversations:start");
      await new Promise((r) => setTimeout(r, 30));
      log.push("conversations:end");
      return [
        { id: "c1", status: "open", category: "shipping", isKnownCustomer: true },
        { id: "c2", status: "open", category: "shipping", isKnownCustomer: true },
      ];
    }
  },
}));
vi.mock("@/dal/messages", () => ({
  MessagesDal: class {
    async findByMerchant() {
      throw new Error("the sidebar must not download full messages");
    }
    async findTimelineByMerchant() {
      log.push("timeline:start");
      await new Promise((r) => setTimeout(r, 30));
      log.push("timeline:end");
      return [
        { conversationId: "c1", sender: "customer", createdAt: "2026-10-01T10:00:00Z" },
        { conversationId: "c2", sender: "customer", createdAt: "2026-10-01T11:00:00Z" },
        { conversationId: "c2", sender: "human_agent", createdAt: "2026-10-01T11:05:00Z" },
      ];
    }
  },
}));

import { Sidebar } from "@/components/layout/sidebar";

function findNavItem(node: unknown, label: string): { badge?: number } | null {
  if (!node || typeof node !== "object") return null;
  const element = node as { props?: Record<string, unknown> };
  if (element.props?.label === label) return element.props as { badge?: number };
  const children = element.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const hit = findNavItem(child, label);
    if (hit) return hit;
  }
  return null;
}

describe("Sidebar inbox badge", () => {
  it("counts only conversations still waiting for an answer, from the slim timeline", async () => {
    const tree = await Sidebar();
    expect(findNavItem(tree, "Inbox")?.badge).toBe(1);
  });

  it("reads conversations and the timeline at the same time", async () => {
    log.length = 0;
    await Sidebar();
    expect(log.slice(0, 2).sort()).toEqual(["conversations:start", "timeline:start"]);
  });
});
