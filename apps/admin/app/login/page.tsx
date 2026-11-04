import { BookOpenCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { isAuth0Configured } from "../../lib/auth/config";
import {
  getAdminSession,
  isLocalTestAuthEnabled,
  loginHref,
} from "../../lib/auth/session";
import { signInAction } from "../../lib/auth/actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const { error } = (await searchParams) ?? {};
  const session = await getAdminSession();

  if (session) {
    redirect("/");
  }

  const auth0Enabled = isAuth0Configured();
  const localTestAuthEnabled = isLocalTestAuthEnabled();

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="login-title">
        <div className="auth-intro">
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

          <div className="auth-assurance">
            <ShieldCheck size={18} />
            <span>
              MFA-ready authentication with role and tenant scoped access.
            </span>
          </div>
        </div>

        <div className="auth-actions">
          {auth0Enabled ? (
            <a className="primary-action" href={loginHref()}>
              <LockKeyhole size={18} />
              Sign in
            </a>
          ) : localTestAuthEnabled ? (
            <form className="auth-form" action={signInAction}>
              <label className="auth-field">
                <span>Email address</span>
                <input
                  autoComplete="email"
                  name="email"
                  placeholder="Work email address"
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

              {error === "invalid_credentials" ? (
                <p className="auth-error-summary" role="alert">
                  The email or password is incorrect, or this account is not
                  active.
                </p>
              ) : null}

              <button className="primary-action" type="submit">
                <LockKeyhole size={18} />
                Sign in
              </button>
            </form>
          ) : (
            <div className="auth-form" role="alert">
              <strong>Authentication is not configured.</strong>
              <p>
                An administrator must configure the approved identity provider
                before this console can accept sign-ins.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
