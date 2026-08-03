"use client";

import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Check, Copy } from "lucide-react";

export function RoomCodePanel({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable — non-critical
    }
  }

  return (
    <Panel className="flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          Room Code
        </div>
        <div className="font-hud text-3xl font-black tracking-[0.12em] text-ink-100">{roomId}</div>
      </div>
      <button
        onClick={copy}
        className="flex items-center gap-1.5 rounded-md border border-border-strong bg-surface-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-300 transition-colors hover:bg-surface-600 hover:text-ink-100"
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </Panel>
  );
}
