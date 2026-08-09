# Enterprise analytics and warehouse exports

The reporting API exposes tenant analytics at
`GET /tenants/{tenantId}/reports/enterprise-analytics` and partner portfolio
analytics at `GET /resellers/{partnerId}/analytics`. Both accept bounded `from`
and `to` ISO dates. Tenant results roll branch metrics into the tenant total;
partner results include only tenants assigned to the authenticated reseller
operator's portfolio.

Export schedules support daily, weekly, or monthly JSON/CSV delivery metadata.
Destinations must be an HTTPS URI, an `s3://` URI, or an external `ref:` value.
Credentials must remain in the external storage/integration system and must not
be placed in the schedule. Each delivery records its target, row count, SHA-256
checksum, timestamps, outcome, and tenant audit evidence where applicable.

The scheduler invokes the scoped `POST .../exports/{scheduleId}/run` endpoint
when `nextRunAt` is due. A successful run advances `nextRunAt` according to the
configured cadence. Failed transport integrations should retain the generated
run evidence and retry through the bounded job retry policy.
