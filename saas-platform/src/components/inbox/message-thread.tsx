import { Card } from "@/components/ui/card";

interface ThreadMessage {
  id: string;
  sender: "customer" | "ai" | "human_agent" | "system" | "ai_draft";
  body: string;
  createdAt?: string;
}

interface MessageThreadProps {
  messages: ThreadMessage[];
}

const BotIconSmall = () => (<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="14" x="3" y="6" rx="2" ry="2"/><path d="M12 2v4"/><path d="M8 12h.01"/><path d="M16 12h.01"/><path d="M12 16c-2 0-3-1-3-1"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>);

export function MessageThread({ messages }: MessageThreadProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
      {messages.length === 0 ? (
         <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
           No messages in this thread yet.
         </div>
      ) : (
        messages.map((message) => {
          const isCustomer = message.sender === "customer";
          const isAi = message.sender === "ai";
          const isSystem = message.sender === "system";
          
          if (isSystem) {
             return (
               <div key={message.id} className="self-center my-4">
                 <span className="bg-zinc-100 text-zinc-500 text-xs px-3 py-1 rounded-full font-medium">
                   {message.body}
                 </span>
               </div>
             );
          }
          
          return (
            <div
              key={message.id}
              className={`flex flex-col max-w-[85%] ${
                isCustomer ? "self-start" : "self-end"
              }`}
            >
              <div
                className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                  isCustomer
                    ? "bg-[#f1f5f9] text-[#111827] rounded-tl-sm border border-zinc-200/60"
                    : isAi || message.sender === "ai_draft"
                      ? "bg-teal-600 text-white rounded-tr-sm"
                      : "bg-blue-600 text-white rounded-tr-sm"
                } ${message.sender === "ai_draft" ? "opacity-75 border border-dashed border-teal-300" : ""}`}
              >
                {message.body}
              </div>
              
              <div className={`flex items-center gap-1.5 mt-1 mx-1 text-[11px] font-medium text-zinc-400 ${isCustomer ? "justify-start" : "justify-end"}`}>
                {(isAi || message.sender === "ai_draft") && (
                  <span className="flex items-center gap-1 text-teal-600">
                    <BotIconSmall /> {message.sender === "ai_draft" ? "AI Agent (Draft)" : "AI Agent"}
                  </span>
                )}
                {!(isAi || message.sender === "ai_draft") && !isCustomer && "You"}
                <span>•</span>
                <span>{message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
