import { describe, expect, it } from "vitest";
import { goldenCases } from "@/config/golden-cases";
import { classifyIntent } from "@/services/intent-service";

describe("intent parity from Python baseline", () => {
  for (const testCase of goldenCases) {
    it(`matches expected intent for ${testCase.id}`, async () => {
      const result = await classifyIntent(testCase.input);
      expect(result.intent).toBe(testCase.expectedIntent);
    });
  }
});
