import { BookOpenCheck, Home } from "lucide-react";
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel auth-panel-single" aria-labelledby="not-found-title">
        <div className="auth-intro">
          <div className="auth-brand">
            <span className="brand-mark">
              <BookOpenCheck size={28} strokeWidth={2.4} />
            </span>
            <span>
              <strong>Virtual School</strong>
              <small>Device Management</small>
            </span>
          </div>

          <div className="auth-copy">
            <span className="eyebrow">Page unavailable</span>
            <h1 id="not-found-title">That console page was not found.</h1>
            <p>
              Return to the operations overview to continue managing schools,
              tablets, policies, and support workflows.
            </p>
          </div>
        </div>

        <div className="auth-actions">
          <Link className="primary-action" href="/">
            <Home size={18} />
            Open overview
          </Link>
        </div>
      </section>
    </main>
  );
}
