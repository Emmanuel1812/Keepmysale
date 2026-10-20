import { InboxIcon } from "@/components/ui/icons";

export default function InboxPage() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-white p-8 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-kept-soft text-kept-strong">
        <InboxIcon className="h-6 w-6" />
      </span>
      <h3 className="text-base font-semibold text-foreground">Pick a conversation</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted">
        The thread opens here with the customer&apos;s order next to it, so you can answer or let the AI draft a reply.
      </p>
    </div>
  );
}
