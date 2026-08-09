# Reseller portfolio and tenant provisioning

Reseller access is explicit: an active partner record contains the only operator subject IDs allowed to use that portfolio. Customer queries always filter by `partnerId`, and portfolio responses contain school identity, commercial status, onboarding state, aggregate student/device counts, open-ticket count, renewal date, and permitted actions. They never return student, device, ticket, or learning-record details.

Create partners with bounded customer and plan limits through `POST /api/v1/resellers`. Assigned operators use `GET /api/v1/resellers/:partnerId/portfolio`, `POST /api/v1/resellers/:partnerId/customers`, and `PATCH /api/v1/resellers/:partnerId/customers/:customerId`. Provisioning requires the configured approval flag, uses a serializable transaction to enforce customer capacity, creates the tenant in `PILOT`, links it to exactly one reseller, and writes a tenant-scoped audit event. Onboarding and renewal updates are likewise assignment-checked and audited.

Operators should treat `ON_HOLD` as a commercial or implementation pause; it does not itself suspend the tenant. Use the existing tenant and billing controls for operational suspension or subscription changes. Capacity or plan changes require an authorized platform administration workflow rather than a provisioning override.

## White-label controls

`PATCH /api/v1/resellers/:partnerId/branding` configures the partner portal identity. At least one syntactically valid approved domain is required. Logos must use HTTPS, colors use six-digit hex values, and an email display name/address must be configured as a pair. The sender address must belong to an approved domain. Updates are audited without storing mail credentials; DNS ownership and provider authentication remain deployment prerequisites.

## Commercial reporting

`GET /api/v1/resellers/:partnerId/commercial-report` returns assigned-customer identity, onboarding and renewal state, plan and billing-period status, and aggregate student/device counts. Access uses the same explicit operator assignment as provisioning. The query intentionally excludes attendance, engagement, content access, assessment, and other learning records.
