# Customer service status and disaster-recovery evidence

The tenant Security and Privacy Center exposes current and historical service incidents, affected modules, scheduled maintenance, and plan-eligible disaster-recovery evidence at `GET /api/v1/tenants/:tenantId/privacy/service-status`. Read access requires `audit:read`; every query is tenant scoped.

Tenant administrators publish incident, maintenance, and DR records through the three `/service-status` POST endpoints. Publications are immutable, require bounded status values and valid time windows, and create tenant audit events. Resolved incidents require a resolution timestamp. DR evidence requires an HTTPS reference and explicit eligible plan keys; customers receive evidence only when their current `planKey` is listed.

Customer summaries and evidence references must exclude credentials, infrastructure secrets, personal data, and internal exploit details. Store detailed exercise artifacts in an access-controlled evidence repository. Publish contractual RPO/RTO values only after legal and operations approval, and publish a newer evidence record rather than modifying historical evidence.
