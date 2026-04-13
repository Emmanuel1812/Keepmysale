import { callGeminiWithRetry } from "../src/lib/gemini/client";

async function testRetry() {
  console.log("Starting retry test...");
  
  let attempts = 0;
  const mockModel: any = {
    model: "test-model",
    generateContent: async () => {
      attempts++;
      if (attempts < 3) {
        console.log(`Simulating 503 error (Attempt ${attempts})`);
        const err: any = new Error("Service Unavailable");
        err.status = 503;
        throw err;
      }
      console.log(`Success on attempt ${attempts}`);
      return { response: { text: () => "Mocked Success" } };
    }
  };

  try {
    const result = await callGeminiWithRetry(mockModel, "test prompt", 3);
    console.log("Final Result:", (result as any).response.text());
    if (attempts === 3) {
      console.log("TEST PASSED: Retry logic worked as expected.");
    } else {
      console.log("TEST FAILED: Unexpected number of attempts.");
    }
  } catch (error) {
    console.error("TEST FAILED with error:", error);
  }
}

testRetry();
