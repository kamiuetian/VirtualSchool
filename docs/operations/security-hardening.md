# Security Hardening

This document captures the Phase 1 server-side hardening controls that must stay enabled before any pilot or production deployment.

## API Runtime Controls

- Production must use `AUTH_MODE=auth0`. Development header authentication is rejected when `NODE_ENV=production` unless `ALLOW_DEVELOPMENT_AUTH_IN_PRODUCTION=true` is deliberately set for an emergency non-production diagnostic environment.
- Swagger/OpenAPI docs are available outside production by default. In production, set `API_DOCS_ENABLED=true` only for a controlled internal environment.
- CORS is allowlist-based through `API_CORS_ORIGINS`. Localhost origins are accepted only outside production.
- `helmet` security headers are enabled for every API request. HSTS is enabled when `NODE_ENV=production`.
- Request body parsing is bounded by `API_REQUEST_BODY_LIMIT`, defaulting to `1mb`.
- API rate limiting is enabled by default with `API_RATE_LIMIT_MAX` requests per `API_RATE_LIMIT_WINDOW_MS` per client IP, method, and path.
- Partner machine credentials add tenant scope, granular scopes, and a per-credential requests-per-minute limit. See [Tenant and partner REST API](partner-api.md).
- `API_TRUST_PROXY=true` is expected behind AWS ALB so the API reads the correct client IP from proxy headers.

## Identity Session Enforcement

Auth0 JWT validation is not enough for Phase 1 privileged operations. When a matching staff user exists in the platform database:

- `SUSPENDED`, `DEACTIVATED`, and non-active staff accounts are rejected.
- Tokens issued before `forcedLogoutAt` are rejected.
- Staff suspension, deactivation, password-reset forced logout, and role-change forced logout must continue setting `forcedLogoutAt`.

This makes staff lifecycle actions effective immediately after the user obtains a fresh Auth0 session.

## Dependency Gate

Pull request and `main` CI run `pnpm audit --audit-level high` after dependency installation and Prisma generation. The current accepted baseline is no high or critical vulnerabilities; moderate findings require review before a production release but do not block the Phase 1 server pipeline.

## Operational Defaults

Production environment values should include:

```env
NODE_ENV=production
AUTH_MODE=auth0
ALLOW_DEVELOPMENT_AUTH_IN_PRODUCTION=false
API_DOCS_ENABLED=false
API_CORS_ORIGINS=https://admin.your-school-mdm-domain.example
API_RATE_LIMIT_ENABLED=true
API_RATE_LIMIT_MAX=300
API_RATE_LIMIT_WINDOW_MS=60000
API_REQUEST_BODY_LIMIT=1mb
API_TRUST_PROXY=true
```

## Regression Cases

- API rejects development auth headers when `NODE_ENV=production`.
- Suspended and deactivated staff accounts cannot authenticate through Auth0-backed API access.
- Tokens issued before `forcedLogoutAt` are rejected.
- Rate limiter allows requests inside the window and returns HTTP 429 after the configured threshold.
- Dependency audit fails CI for high and critical vulnerabilities.
