# Tenant branding

School administrators configure branding in **Tenants → School profile and branding**. The validated profile is tenant-scoped and audited.

- Logo and website URLs must use HTTPS.
- Primary and accent colors must be six-digit hex colors with at least 4.5:1 contrast against white text. The product defaults are used when a value is absent.
- Student and device terminology is limited to 32 characters.
- School name, logo, colors, terminology, website, and support contacts are exposed only in that tenant's admin/guardian presentation and managed-launcher policy payload.
- Alert-email webhook payloads include a `branding` object and use the school name in the subject. Providers should render supplied branding accessibly and fall back to plain text.

Existing API clients remain compatible because all new response properties are additive and profile fields are optional.
