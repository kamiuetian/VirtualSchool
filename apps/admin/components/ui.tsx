import type { ReactNode } from "react";

export function PageSection({
  actions,
  children,
  kicker,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  kicker?: string;
  title: string;
}) {
  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          {kicker ? <span className="eyebrow">{kicker}</span> : null}
          <h2>{title}</h2>
        </div>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function StatCard({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "good" | "warning" | "critical";
  value: string;
}) {
  return (
    <article className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warning" | "critical";
}) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

export function EmptyState({ body, title }: { body: string; title: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

export function ProgressBar({
  tone = "good",
  value,
}: {
  tone?: "good" | "warning" | "critical";
  value: number;
}) {
  return (
    <span className="progress-track" aria-label={`${value}%`}>
      <span
        className={`progress-fill ${tone}`}
        style={{ width: `${value}%` }}
      />
    </span>
  );
}

export function Field({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function ActionPanel({
  actions,
  children,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="action-panel">
      <div className="action-panel-header">
        <h3>{title}</h3>
        {actions ? <div className="action-panel-actions">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button className="submit-button" type="submit">
      {children}
    </button>
  );
}
