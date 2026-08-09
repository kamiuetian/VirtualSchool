# Integration marketplace and partner review

Tenant administrators use **Admin > Integrations > Integration marketplace** to inspect published integrations, enable a specific published version, run its declared readiness test, and disable it without deleting installation or audit evidence.

Partner submissions are tenant scoped and versioned. A manifest must declare an HTTPS `testUrl` and at least one requested scope. Each version follows `DRAFT`, `SUBMITTED`, `IN_REVIEW`, `APPROVED` or `REJECTED`, then `PUBLISHED`; transitions cannot be skipped, and rejection requires reviewer notes. Create a new version to revise a rejected or already-published integration.

Publication does not grant access by itself. An administrator must enable the published version for a tenant. The test action validates the enabled installation against the reviewed manifest without exposing stored configuration. Enable, test, disable, submission, review, rejection, and publication actions create tenant-scoped audit events.
