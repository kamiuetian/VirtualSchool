# Moodle and Canvas integrations

Tenant admins configure Moodle or Canvas with an HTTPS base URL and an `arn:`, `vault://`, or `secret://` credential reference. Virtual School never accepts or stores the credential value. Course mappings are tenant- and provider-scoped; every launcher URL must share the configured LMS origin.

Set `LMS_CONNECTION_TEST_URL` to the connection-test adapter endpoint and optionally set `LMS_CONNECTION_TEST_TOKEN`. The API sends the provider, base URL, and secret reference to that trusted adapter, which resolves the credential and performs the provider-specific check. Test outcomes are stored and audited without response bodies or credential data.

Disabling a provider immediately removes its mapped links from managed-device policy payloads. Mappings remain stored and become available again when the provider is re-enabled, avoiding orphaned course associations.
