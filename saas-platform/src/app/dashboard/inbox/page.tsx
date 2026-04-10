// --- [ICONS] ---
const InboxEmptyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-200 mb-6">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
);

export default function InboxPage() {
  return (
    <div className="flex flex-col h-full w-full items-center justify-center bg-white p-8">
      <InboxEmptyIcon />
      <h3 className="text-lg font-semibold text-[#111827]">Select a conversation</h3>
      <p className="mt-2 text-sm text-zinc-500 max-w-sm text-center">
        Choose a conversation from the list to view the thread, see order details, and respond to the customer.
      </p>
    </div>
  );
}
