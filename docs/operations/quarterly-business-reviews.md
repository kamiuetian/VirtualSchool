# Enterprise quarterly business reviews

Authorized customer-success and reporting users generate a tenant review with
`POST /tenants/{tenantId}/reports/quarterly-business-reviews` and a `quarter`
value in `YYYY-Q1` through `YYYY-Q4` form. The API also provides tenant-scoped
list and detail endpoints under the same path. All operations require
`report:export`; the request tenant remains the data boundary.

Each pack is an immutable snapshot. It records adoption, managed-device health
and compliance, policy-delivery success, support demand and resolution,
learning-session and mode usage, and comparison with the preceding quarter.
Recommendations are deterministic operating prompts and include the metric
evidence that triggered them; they do not change policy or device state.

The stored SHA-256 checksum covers the business snapshot. Generation records
the authenticated actor and a tenant audit event. Packs cannot be updated or
deleted through the API. Customer-success teams should export or present a pack
only to recipients authorized for that tenant and should treat small cohorts as
sensitive operational data.
