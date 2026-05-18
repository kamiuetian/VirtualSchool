import { BookOpenCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { isAuth0Configured } from "../../lib/auth/config";
import { getAdminSession, loginHref } from "../../lib/auth/session";
import { signInAction } from "../../lib/auth/actions";

export const dynamic = "force-dynamic";

const accessProfiles = [
  ["PLATFORM_SUPER_ADMIN", "Platform super admin"],
  ["SCHOOL_ADMIN", "School admin"],
  ["IT_ADMIN", "IT admin"],
  ["ACADEMIC_ADMIN", "Academic admin"],
  ["TEACHER", "Teacher"],
  ["SUPPORT_AGENT", "Support agent"],
  ["BILLING_ADMIN", "Billing admin"],
  ["AUDITOR", "Auditor"],
] as const;

export default async function LoginPage() {
  const session = await getAdminSession();

  if (session) {
    redirect("/");
  }

  const auth0Enabled = isAuth0Configured();

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-brand">
          <span className="brand-mark">
            <BookOpenCheck size={28} strokeWidth={2.4} />
          </span>
          <span>
            <strong>Virtual School</strong>
            <small>Device Management</small>
          </span>
        </div>

        <div className="auth-copy">
          <span className="eyebrow">Secure school operations</span>
          <h1 id="login-title">Sign in to manage learning tablets.</h1>
          <p>
            Access enrollment batches, device health, policies, schedules, and
            support workflows from one protected console.
          </p>
        </div>

        <div className="auth-actions">
          {auth0Enabled ? (
            <a className="primary-action" href={loginHref()}>
              <LockKeyhole size={18} />
              Sign in
            </a>
          ) : (
            <form className="auth-form" action={signInAction}>
              <div className="auth-form-grid">
                <label className="auth-field">
                  <span>Email address</span>
                  <input
                    autoComplete="email"
                    defaultValue="admin@example.edu"
                    name="email"
                    required
                    type="email"
                  />
                </label>

                <label className="auth-field">
                  <span>Password</span>
                  <input
                    autoComplete="current-password"
                    name="password"
                    placeholder="Enter password"
                    required
                    type="password"
                  />
                </label>

                <label className="auth-field">
                  <span>Full name</span>
                  <input
                    autoComplete="name"
                    defaultValue="School Administrator"
                    name="name"
                    type="text"
                  />
                </label>

                <label className="auth-field">
                  <span>Access profile</span>
                  <select defaultValue="PLATFORM_SUPER_ADMIN" name="role">
                    {accessProfiles.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="auth-field">
                <span>School scope</span>
                <input defaultValue="*" name="tenantIds" type="text" />
                <small>
                  Use * for platform access or tenant IDs separated by commas.
                </small>
              </label>

              <button className="primary-action" type="submit">
                <LockKeyhole size={18} />
                Sign in
              </button>
            </form>
          )}
        </div>

        <div className="auth-assurance">
          <ShieldCheck size={18} />
          <span>MFA-ready authentication with role and tenant scoped access.</span>
        </div>
      </section>
    </main>
  );
}
