# Enterprise SSO and SCIM operations

Tenant administrators configure enterprise identity at `tenants/{tenantId}/enterprise-identity`. SAML requires an HTTPS metadata URL; OIDC requires a client ID and HTTPS issuer. Signing credentials and SCIM bearer tokens must be external secret references using `arn:`, `vault://`, or `secret://`; raw secrets are rejected and never returned as usable credentials.

Before activation, create or select an active `SCHOOL_ADMIN` or `IT_ADMIN` account with MFA enabled. This tenant-local account remains the break-glass login if the identity provider is unavailable. Test it during each access review and never map it to a SCIM-managed identity.

Create group mappings before provisioning. Each external group maps to one bounded staff role and optional tenant branch. A SCIM user must resolve to exactly one mapping; missing or ambiguous mappings fail closed. External IDs are tenant-scoped and idempotent. Update changes profile and mapped access, suspend forces logout, and delete is implemented as audited soft-deactivation so identity history is preserved.

Identity-provider and SCIM gateways should call the API with a machine identity carrying only `tenant:update` for the target tenant. Rotate the referenced SSO credential and SCIM token in the secret manager, then submit the updated references. Monitor audit actions prefixed with `enterprise_identity.` and `scim.` for configuration, mapping, and lifecycle evidence.
