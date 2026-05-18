"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="auth-page">
      <section className="auth-panel auth-panel-single" aria-labelledby="error-title">
        <div className="auth-intro">
          <div className="auth-copy">
            <span className="eyebrow">Console interrupted</span>
            <h1 id="error-title">This page could not be loaded.</h1>
            <p>
              The console hit a temporary problem while preparing the current
              view. Try again, or sign out and back in if the issue persists.
            </p>
          </div>
        </div>

        <div className="auth-actions">
          <div className="auth-error-summary" role="alert">
            <AlertTriangle size={18} />
            <span>{error.message || "The requested console view failed."}</span>
          </div>
          <button className="primary-action" type="button" onClick={reset}>
            <RotateCcw size={18} />
            Try again
          </button>
        </div>
      </section>
    </main>
  );
}
