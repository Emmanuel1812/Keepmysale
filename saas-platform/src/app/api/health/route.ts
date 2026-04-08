import { apiResponse } from "@/lib/api-helpers";

export async function GET() {
  return apiResponse({
    status: "ok",
    service: "returnshield-saas-platform",
    now: new Date().toISOString(),
  });
}
