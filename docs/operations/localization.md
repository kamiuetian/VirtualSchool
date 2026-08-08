# Core UI localization

Virtual School supports English (`en`) and Urdu (`ur`) for core admin, guardian, and managed-student launcher text.

- The tenant profile language is the default for all three surfaces.
- Admin users can select the school default, English, or Urdu from the console header. The override is stored in an HTTP-only preference cookie and does not change the tenant.
- Guardians retain their audited profile-level language override.
- Managed launchers receive `language` in Android managed configuration. Operators may set `languageOverride` to `en` or `ur` for an individual managed device; invalid values fall back to the tenant language, then English.
- Urdu renders right-to-left in the admin shell. User-entered school, person, class, and resource names are never translated.

Both web and launcher catalogs have completeness tests. Unknown locales fall back deterministically to English, while a missing Urdu key falls back to its English source text.
