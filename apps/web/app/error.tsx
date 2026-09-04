"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Card } from "@/components/Card";

/**
 * Route-level error boundary.
 *
 * The whole app is a live simulator: every page drives a large pure-TS engine
 * on the client. Without this, one unexpected throw anywhere in that engine
 * replaces the entire page with a blank screen and a bare "Application error"
 * in production, which tells the reader nothing and offers no way back.
 *
 * `reset()` re-renders the route without a full reload, which matters here:
 * the SimStore lives above this boundary, so retrying keeps the world the
 * user has already built up instead of resetting them to genesis.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-xl space-y-4 text-center">
      <h1 className="optical-title font-display text-2xl text-paper">
        The simulation hit an error
      </h1>
      <p className="text-sm leading-relaxed text-white/60">
        Something in the model threw where it shouldn&apos;t have. Your world is still
        in memory — retrying re-renders this page without resetting it.
      </p>
      {error.message ? (
        <p className="rounded-lg border border-contraction/25 bg-contraction/[0.07] px-3 py-2 text-left font-mono text-xs text-contraction/90">
          {error.message}
          {error.digest ? <span className="block text-white/40">digest: {error.digest}</span> : null}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.14] bg-white/[0.04] px-4 py-2 text-sm text-paper transition-colors duration-150 hover:bg-white/[0.08]"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Try again
      </button>
    </Card>
  );
}
