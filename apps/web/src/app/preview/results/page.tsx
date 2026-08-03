"use client";

import { Logo } from "@/components/ui/Logo";
import { ResultsView } from "@/components/results/ResultsView";
import { mockResults } from "@/lib/mock";

export default function ResultsPreviewPage() {
  const results = mockResults(24, "You");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-8 py-4">
        <Logo />
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-700">
          Design Preview — Not Connected
        </span>
      </header>
      <ResultsView
        results={results}
        localPlayerId="local-player"
        isHost
        onRematch={() => {}}
        onReturnToLobby={() => {}}
      />
    </div>
  );
}
