"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { VoiceProfile } from "@/lib/automation/voice";

interface VoiceCardProps {
  profile: VoiceProfile | null | undefined;
  enabled: boolean;
  gmailConnected: boolean;
  /** A change the merchant still has to save (edit of the description, the switch) */
  onChange: (key: "voice_profile" | "voice_enabled", value: unknown) => void;
  /** A profile the server already saved: update the page without asking to save again */
  onLearned: (profile: VoiceProfile) => void;
}

/** Settings → AI persona: learn the shop's own writing style from its sent replies, and switch it on or off. */
export function VoiceCard({ profile, enabled, gmailConnected, onChange, onLearned }: VoiceCardProps) {
  const [learning, setLearning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function learn() {
    setLearning(true);
    setError(null);
    try {
      const res = await fetch("/api/merchant/voice", { method: "POST" });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        setError(payload?.error?.message ?? payload?.error ?? "Could not learn your voice. Try again.");
        return;
      }
      onLearned(payload.data.voiceProfile as VoiceProfile);
    } finally {
      setLearning(false);
    }
  }

  return (
    <Card className="mt-6 overflow-hidden !p-0">
      <CardHeader className="!mb-0 border-b border-line px-6 py-5 sm:px-8">
        <CardTitle className="text-base">Your voice</CardTitle>
        <CardDescription>
          KeepMySale reads the replies you sent yourself and writes new ones the way you do: your length, your words, je or u.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-6 sm:p-8">
        {profile ? (
          <>
            <label className="flex cursor-pointer items-start justify-between gap-6">
              <span>
                <span className="block text-sm font-semibold text-foreground">Write in my voice</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {enabled ? "Replies follow the description below instead of the tone setting." : "Off: replies use the tone of voice setting above."}
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={enabled}
                onChange={(e) => onChange("voice_enabled", e.target.checked)}
                className="mt-1 h-5 w-9 shrink-0 cursor-pointer accent-[var(--kept)]"
              />
            </label>

            <div className="space-y-2">
              <label htmlFor="voice-summary" className="text-[13px] font-medium text-foreground">How you write</label>
              <textarea
                id="voice-summary"
                rows={5}
                maxLength={900}
                value={profile.summary}
                onChange={(e) => onChange("voice_profile", { ...profile, summary: e.target.value })}
                className="w-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-kept"
              />
              <p className="text-xs text-muted">
                Learned from {profile.sampleCount} of your replies{profile.address ? `, you address customers with "${profile.address}"` : ""}. Edit it freely.
              </p>
            </div>

            {profile.examples.length ? (
              <div className="space-y-2">
                <p className="text-[13px] font-medium text-foreground">Sounds like</p>
                <ul className="space-y-1.5">
                  {profile.examples.map((example) => (
                    <li key={example} className="rounded-[10px] bg-surface-2 px-3 py-2 text-[13px] text-foreground ring-1 ring-inset ring-line">
                      “{example}”
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">
            Nothing learned yet. It takes about half a minute and only reads mail you sent; nothing is changed in your mailbox.
          </p>
        )}

        {error ? <p role="alert" className="text-[13px] text-lost">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant={profile ? "outline" : "default"} onClick={learn} loading={learning} disabled={!gmailConnected}>
            {learning ? "Reading your replies" : profile ? "Learn again" : "Learn from my sent replies"}
          </Button>
          {!gmailConnected ? <span className="text-xs text-muted">Connect Gmail first (General tab).</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
