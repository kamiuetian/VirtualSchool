# Access governance operations

Tenant school administrators manage delegated access from the **Access** area.

- Build templates from the supported tenant permissions. `tenant:create` is reserved for platform operators and cannot be delegated.
- Assign a template at tenant, region, or branch scope. Branches used for region delegation must have `Branch.regionCode` populated by provisioning or migration tooling.
- Assignments may expire. Active custom assignments replace the user's built-in role permissions at authentication; they do not add permissions to that role.
- Assignment, revocation, and review decisions force the affected user to sign in again. Every operation writes an audit event.
- Start periodic reviews to snapshot all active, unexpired delegated assignments. Each item must be confirmed or revoked with a reason. The review closes when no item remains pending.
- Export review CSV evidence from the review panel for the compliance record. Exports contain staff access metadata, decisions, and reviewer evidence, but no credentials or authentication tokens.

For branch and region delegates, API requests that target a `branchId` outside the resolved assignment scope are denied. Removing a region code from a branch takes effect at the user's next authentication.
