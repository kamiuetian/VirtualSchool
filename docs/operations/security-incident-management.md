# Security and privacy incident management

The tenant Privacy API provides a restricted incident register at `/api/v1/tenants/:tenantId/privacy/security-incidents`. Every endpoint requires `audit:read`, limiting access to the platform, school-security, IT-security, and auditor roles already authorized for security evidence. All database queries include the authenticated tenant path, and incident owners must be active users in that tenant.

Incidents record a bounded classification and severity, accountable owner, minimum necessary description, and HTTPS evidence references. Investigation, containment, recovery, customer-communication, and evidence updates form an append-only timeline. Closed incidents reject later timeline changes and retain the closing actor, timestamp, and summary. Creation, timeline, and closure operations write non-secret audit events.

The `/security-incidents/:incidentId/export` endpoint returns a customer-facing JSON record with tenant identity, incident details, timeline, evidence references, and closure outcome. Evidence URLs should point to an access-controlled evidence store; credentials, tokens, raw child data, and infrastructure secrets must never be placed in descriptions, updates, or URLs.
