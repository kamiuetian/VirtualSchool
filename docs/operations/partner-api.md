# Tenant and partner REST API

The versioned REST surface is rooted at `/api/v1`. Its OpenAPI document is available at `/api/docs-json` when `API_DOCS_ENABLED=true`; Swagger UI is at `/api/docs`. Production documentation should be enabled only in a controlled environment.

Tenant administrators create machine credentials with `POST /api/v1/tenants/{tenantId}/machine-credentials`. Choose `API_KEY` for direct `X-API-Key` requests or `OAUTH_CLIENT` for the client-credentials flow. Secrets are displayed only in the create or rotate response, stored as SHA-256 hashes, and must be copied immediately to an approved secret manager.

Supported scopes are `tenant.read`, `roster.read`, `roster.write`, `devices.read`, `reports.read`, and `audit.read`. Each credential is restricted to its owning tenant. Set a per-credential requests-per-minute limit appropriate for the integration; the platform-wide IP limit remains an additional ceiling.

## Sandbox examples

Create a read-only API key in a non-production tenant, then call:

```bash
curl -H "X-API-Key: $VIRTUAL_SCHOOL_API_KEY" \
  https://sandbox.example.com/api/v1/partner/tenants/$TENANT_ID/roster
```

For OAuth client credentials:

```bash
curl -X POST https://sandbox.example.com/api/v1/partner-auth/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"client_credentials","client_id":"CLIENT_ID","client_secret":"CLIENT_SECRET"}'

curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  https://sandbox.example.com/api/v1/partner/tenants/$TENANT_ID/devices
```

OAuth access tokens expire after one hour. Rotation invalidates outstanding OAuth tokens and supports a configurable old-secret grace period (15 minutes by default). Revocation is immediate for API keys and OAuth clients. Credential creation, rotation, revocation, token issuance, and machine reads are recorded in tenant audit events without recording secrets or bearer tokens.
