# High-risk policy change approvals

Tenant administrators can enable approval gates independently for broad unlocks, removal of web blocks, and exam changes. The gate supports one to three approvals. Keep two approvals for production tenants so a requester and a single compromised account cannot authorize the same change.

Use `PATCH /tenants/{tenantId}/change-approvals/config` to configure the operation classes and quorum. Policy managers submit a reason-bound proposal to `/requests` with the target plus complete `oldValue` and `newValue` snapshots. The proposal expires after 24 hours. Users with audit access compare those snapshots and submit a decision. A requester cannot decide their own request, each approver gets one decision, any rejection is final, and the configured number of distinct approvals is required.

The dashboard endpoint returns the actor, approvers, decisions, before/after values, timestamps, and outcome for tenant-scoped review. Every configuration, request, approval, rejection, and expiry is also written to the immutable audit stream. Never put secrets, student content, browsing history, or raw credentials in a change snapshot; store stable identifiers and policy configuration only.

An approved record is authorization evidence, not a reason to bypass ordinary RBAC, tenant checks, validation, or device safeguards. Operators should correlate the approved request ID with the subsequent policy audit event and investigate approved requests that have no matching outcome.
