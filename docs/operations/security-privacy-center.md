# Security and privacy center

The tenant Privacy page consolidates the evidence a privacy officer needs to review data location and filtering configuration, staff and delegated-access posture, open access reviews, retention windows, incident contacts, policy references, child-safety guardrails, and the tenant audit API path.

`GET /api/v1/tenants/:tenantId/privacy/security-center` requires `audit:read`. It derives every count and setting with the route tenant ID and never returns another tenant's records. Auditors can inspect the center but cannot change its profile. `PUT /api/v1/tenants/:tenantId/privacy/security-center/profile` requires `tenant:update`; it stores incident contact details, HTTPS-only policy-document references, and explicit child-safety guardrails. Each accepted update creates a tenant-scoped `security_privacy_profile.update` audit event containing counts and the contact address, not policy contents.

Policy documents remain in their approved document system; this feature stores links rather than file contents. Child-safety guardrails should state enforceable boundaries such as prohibiting covert monitoring, private-message capture, camera or microphone surveillance, and unnecessary location collection. Review the profile and privileged MFA indicator during every scheduled access review.

The audit evidence path points to the existing authenticated tenant audit endpoint. It is not a public download link and continues to require `audit:read`.
