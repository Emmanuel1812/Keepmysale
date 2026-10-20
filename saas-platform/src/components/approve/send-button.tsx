"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** The approval page's Send button: shows that it is sending and cannot be pressed twice. */
export function SendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending} disabled={pending}>
      {pending ? "Sending" : "Send reply"}
    </Button>
  );
}
