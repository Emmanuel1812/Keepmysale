import type { IntentType } from "@/types/domain";

export interface GoldenCase {
  id: string;
  input: string;
  expectedIntent: IntentType;
}

export const goldenCases: GoldenCase[] = [
  {
    id: "resend-nl-1",
    input: "Ik heb geen bevestigingsmail ontvangen. Kunnen jullie de orderbevestiging opnieuw sturen?",
    expectedIntent: "resend_confirmation",
  },
  {
    id: "wismo-en-1",
    input: "Hi, where is my order #1023? I still do not have tracking.",
    expectedIntent: "wismo",
  },
  {
    id: "return-en-1",
    input: "I want to return this order, the product arrived damaged.",
    expectedIntent: "return_request",
  },
  {
    id: "general-en-1",
    input: "Can you update my invoice company name?",
    expectedIntent: "general_support",
  },
  {
    id: "resend-pt-1",
    input: "Nao recebi confirmacao de encomenda, pode reenviar?",
    expectedIntent: "resend_confirmation",
  },
];
