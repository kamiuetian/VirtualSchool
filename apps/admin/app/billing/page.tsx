import { AppShell } from "../../components/app-shell";
import { EmptyState, PageSection, ProgressBar, StatCard, StatusPill } from "../../components/ui";
import { getAdminData } from "../../lib/api";
import { formatCount, formatDate, percent } from "../../lib/format";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const data = await getAdminData();
  const usage = data.billingUsage;

  return (
    <AppShell connectionIssue={data.connectionIssue} tenant={data.selectedTenant}>
      <div className="content-stack">
        <PageSection kicker="Commercial readiness" title="Plan Usage">
          {usage ? (
            <section className="stat-grid" aria-label="Plan summary">
              <StatCard label="Plan" value={usage.plan.name} />
              <StatCard
                label="Subscription"
                tone={usage.subscription.status === "ACTIVE" ? "good" : "neutral"}
                value={usage.subscription.status}
              />
              <StatCard
                label="Warnings"
                tone={usage.totals.warningCount > 0 ? "warning" : "good"}
                value={formatCount(usage.totals.warningCount)}
              />
              <StatCard
                label="Over limit"
                tone={usage.totals.overLimitCount > 0 ? "critical" : "good"}
                value={formatCount(usage.totals.overLimitCount)}
              />
            </section>
          ) : (
            <EmptyState
              title="No billing profile"
              body="A billing profile is created with the school tenant and will track plan usage here."
            />
          )}
        </PageSection>

        {usage ? (
          <>
            <PageSection title="Usage By Limit">
              <div className="usage-grid">
                {usage.metrics.map((metric) => (
                  <article className="usage-card" key={metric.key}>
                    <div>
                      <strong>{metric.label}</strong>
                      <span>
                        {formatCount(metric.used)} of{" "}
                        {metric.limit === null ? "unlimited" : formatCount(metric.limit)}
                      </span>
                    </div>
                    <ProgressBar
                      tone={
                        metric.overLimit
                          ? "critical"
                          : (metric.percentUsed ?? 0) >= 80
                            ? "warning"
                            : "good"
                      }
                      value={Math.min(metric.percentUsed ?? 0, 100)}
                    />
                    <span className="usage-caption">{percent(metric.percentUsed)}</span>
                  </article>
                ))}
              </div>
            </PageSection>

            <PageSection title="Billing Profile">
              <div className="profile-grid">
                <div>
                  <span>Billing contact</span>
                  <strong>{usage.subscription.billingEmail ?? "Not recorded"}</strong>
                </div>
                <div>
                  <span>Billing period</span>
                  <strong>
                    {formatDate(usage.subscription.billingPeriodStart)} to{" "}
                    {formatDate(usage.subscription.billingPeriodEnd)}
                  </strong>
                </div>
                <div>
                  <span>Trial ends</span>
                  <strong>{formatDate(usage.subscription.trialEndsAt)}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <StatusPill tone={usage.subscription.status === "ACTIVE" ? "good" : "neutral"}>
                    {usage.subscription.status}
                  </StatusPill>
                </div>
              </div>
            </PageSection>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
