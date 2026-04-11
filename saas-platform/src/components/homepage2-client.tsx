"use client";

/**
 * Renders the Homepage2.html file as a full-page iframe.
 * This preserves 100% visual fidelity — no CSS conflicts
 * with the Next.js root layout, all original animations
 * and scripts run natively in their own document context.
 *
 * Links inside the HTML (signup, login) have been updated
 * to point to /onboarding in the public copy.
 */
export function Homepage2Client() {
  return (
    <iframe
      src="/homepage2.html"
      style={{
        width: "100vw",
        height: "100vh",
        border: "none",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
        background: "#060b14",
      }}
      title="KeepMySale — AI Customer Service That Saves Your Returns"
    />
  );
}
