import { Card } from "@/components/ui/card";

interface ThreadMessage {
  id: string;
  sender: "customer" | "ai";
  body: string;
}

interface MessageThreadProps {
  messages: ThreadMessage[];
}

export function MessageThread({ messages }: MessageThreadProps) {
  return (
    <Card className="flex h-full flex-col gap-3">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${
            message.sender === "customer"
              ? "self-start bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              : "self-end bg-black text-white dark:bg-white dark:text-black"
          }`}
        >
          {message.body}
        </div>
      ))}
    </Card>
  );
}
