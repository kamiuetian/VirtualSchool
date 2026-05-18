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

## Admin Portal Login

The admin portal uses Auth0 as the production session provider. Configure these
environment variables for the Next.js admin service:

- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_SECRET`
- `APP_BASE_URL`
- `AUTH0_AUDIENCE`
- `ADMIN_API_BASE_URL`

The Auth0 application must be a Regular Web Application. Add
`<APP_BASE_URL>/auth/callback` to Allowed Callback URLs and `<APP_BASE_URL>` to
Allowed Logout URLs. The portal signs users in through `/auth/login`, signs them
out through `/auth/logout`, and sends the server-side access token to the API as
a Bearer token.

For local development only, when Auth0 is not configured, the portal exposes a
cookie-backed sign-in button at `/login` and forwards development auth headers
to the API. CI can set `ADMIN_AUTH_BYPASS=true` to avoid an external Auth0
dependency during browser regression tests.

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
