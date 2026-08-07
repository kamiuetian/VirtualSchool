# Teacher Class Mode controls

Class Mode is limited to a teacher's explicitly assigned active class. While a session is active, the teacher can:

- push an app resource only when it is approved in the tenant catalog and its grade scope includes the class;
- display a focus message for 1 to 10 minutes;
- approve an HTTP(S) URL for 1 to 60 minutes when the active published class policy does not block it.

Each action is recorded as a durable teacher-session event and audit event. Delivery is queued only for non-retired devices currently assigned to the session class, with an expiry matching the bounded action. Temporary URL approval never overrides a matching policy block rule. An active published tenant or class policy is required so the blocklist can be evaluated before approval.

Ending Class Mode stops new teacher actions. Existing queued actions retain their explicit expiry and are not expanded to other classes or devices.
