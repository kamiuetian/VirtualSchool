# Cross-platform policy mapping

Business policies remain the authoritative source for kiosk, managed web filtering, and managed app deployment. A draft policy can carry explicit overrides for a selected operating system; overrides do not modify other platforms.

Before publication, use `POST /api/v1/tenants/:tenantId/policies/:policyId/simulate-platform` with a platform, enrollment type, ownership type, and optional OS version. The response identifies each effective value and its source, capability support, override conflicts, unsupported enabled controls, and whether the target combination is publishable. A conflict means an intentional OS value differs from the business default. A non-publishable preview means an enabled control has no supported mapping for that target.

Use `PATCH /api/v1/tenants/:tenantId/policies/:policyId/platform-overrides` only for draft policies. The request replaces the selected platform's explicit override set and writes a tenant-scoped `policy.platform_overrides.update` audit event. Permission `policy:manage` is required for both editing and previewing.

The capability catalog is the support authority. `PARTIAL` mappings remain previewable and retain their provider limitation note; teams should confirm the named connector prerequisites before rollout.
