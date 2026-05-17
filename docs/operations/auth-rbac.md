# Auth And RBAC Operations

The API uses a global auth/RBAC guard for every route except health checks.

## Modes

- `AUTH_MODE=development`: local smoke-test mode. Requests can use `x-dev-role`,
  `x-dev-tenant-id`, `x-dev-subject`, and `x-dev-email` headers. This mode is
  rejected when `NODE_ENV=production` unless
  `ALLOW_DEVELOPMENT_AUTH_IN_PRODUCTION=true` is deliberately set.
- `AUTH_MODE=auth0`: production mode. Requests must include an Auth0-issued Bearer
  token validated against the configured issuer, audience, and JWKS endpoint.

Production requires:

- `AUTH0_AUDIENCE`
- `AUTH0_ISSUER_BASE_URL` or `AUTH0_DOMAIN`
- Optional `AUTH0_JWKS_URI` override

## Token Claims

Auth0 tokens should include:

- `sub`: stable Auth0 subject.
- `email`: staff email, when available.
- `https://virtualschool/role`: one platform role.
- `https://virtualschool/tenant_ids`: tenant IDs the user may access.

`PLATFORM_SUPER_ADMIN` is treated as cross-tenant. Other roles must carry tenant IDs.

When a matching staff user exists in the platform database, API authentication
also rejects non-active accounts and Auth0 tokens issued before `forcedLogoutAt`.

## Local Smoke Headers

Example:

```text
x-dev-role: IT_ADMIN
x-dev-tenant-id: tenant-1
x-dev-subject: auth0|local-it-admin
x-dev-email: it-admin@example.edu
```

Development mode is not suitable for shared staging or production environments.
