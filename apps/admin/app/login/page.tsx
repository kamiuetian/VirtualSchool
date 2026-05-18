import { BookOpenCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { isAuth0Configured } from "../../lib/auth/config";
import { getAdminSession, loginHref } from "../../lib/auth/session";
import { signInAction } from "../../lib/auth/actions";

export const dynamic = "force-dynamic";

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
            <form action={signInAction}>
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
