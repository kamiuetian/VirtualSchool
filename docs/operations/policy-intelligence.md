# Policy intelligence operations

The tenant security center exposes explainable policy recommendations and anomaly alerts. Recommendations use current tenant-scoped device compliance, policy-delivery, and blocked-domain aggregates. Every suggestion includes its supporting counts and proposed review action. A suggestion remains `PENDING` until an administrator with policy-management permission records an approval or rejection and reason; approval records intent and never changes or publishes a policy automatically.

Anomaly scans inspect the previous 24 hours for elevated device lifecycle changes, failed or expired policy deliveries, and unusually high audited activity by one administrator. Alerts include the observed count, time window, and threshold. Daily fingerprints make repeated scans idempotent. Privacy/audit users can acknowledge or resolve an alert with an investigation note, and each scan and state transition is tenant-scoped and audited.

Operators should investigate the cited records before acting. Thresholds identify unusual volume, not malicious behavior. Use the existing change-approval and policy-publication workflows for any remediation, and use security incidents when investigation establishes an incident.
