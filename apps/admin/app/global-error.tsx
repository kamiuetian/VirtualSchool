"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="auth-page">
          <section className="auth-panel auth-panel-single" aria-labelledby="error-title">
            <div className="auth-intro">
              <div className="auth-copy">
                <span className="eyebrow">Console interrupted</span>
                <h1 id="error-title">Virtual School could not start this view.</h1>
                <p>
                  The protected console encountered a page-level error. Try
                  again once the application finishes refreshing.
                </p>
              </div>
            </div>

            <div className="auth-actions">
              <div className="auth-error-summary" role="alert">
                <AlertTriangle size={18} />
                <span>The console could not render the requested screen.</span>
              </div>
              <button className="primary-action" type="button" onClick={reset}>
                <RotateCcw size={18} />
                Try again
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
