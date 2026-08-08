import {
  AlertTriangle,
  AppWindow,
  BarChart3,
  BookOpenCheck,
  Boxes,
  CalendarClock,
  GraduationCap,
  HeartHandshake,
  PlugZap,
  Laptop,
  LayoutDashboard,
  QrCode,
  ReceiptText,
  FileBarChart,
  Headset,
  ShieldCheck,
  FileLock2,
  LogOut,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { TenantBranding } from "@virtual-school/shared";
import {
  type PortalHref,
  visiblePortalNavigation,
} from "../lib/auth/portal-access";
import { getAdminSession, logoutHref } from "../lib/auth/session";
import { coreText } from "../lib/core-i18n";
import { resolveAdminLocale } from "../lib/locale";
import { updateAdminLanguageAction } from "../lib/actions";

const navigationIcons = {
  "/": LayoutDashboard,
  "/alerts": AlertTriangle,
  "/apps": AppWindow,
  "/billing": ReceiptText,
  "/devices": Laptop,
  "/enrollment": QrCode,
  "/policies": ShieldCheck,
  "/privacy": FileLock2,
  "/reports": FileBarChart,
  "/roster": Users,
  "/support": Headset,
  "/teacher": BookOpenCheck,
  "/guardian": HeartHandshake,
  "/tenants": GraduationCap,
  "/timetable": CalendarClock,
  "/integrations": PlugZap,
} satisfies Record<PortalHref, typeof LayoutDashboard>;

const roleLabels: Record<string, string> = {
  ACADEMIC_ADMIN: "Academic admin",
  AUDITOR: "Auditor",
  BILLING_ADMIN: "Billing admin",
  IT_ADMIN: "IT admin",
  PLATFORM_SUPER_ADMIN: "Platform super admin",
  SCHOOL_ADMIN: "School admin",
  SUPPORT_AGENT: "Support agent",
  TEACHER: "Teacher",
  GUARDIAN: "Guardian",
};

export async function AppShell({
  children,
  connectionIssue,
  tenant,
}: {
  children: ReactNode;
  connectionIssue?: boolean;
  tenant: TenantBranding | null;
}) {
  const session = await getAdminSession();
  const navigation = session ? visiblePortalNavigation(session.role) : [];
  const locale = await resolveAdminLocale(tenant?.language);
  const t = (key: Parameters<typeof coreText>[1]) => coreText(locale, key);
  const navigationKeys: Record<PortalHref, Parameters<typeof coreText>[1]> = {
    "/": "dashboard",
    "/alerts": "alerts",
    "/apps": "apps",
    "/billing": "billing",
    "/devices": "devices",
    "/enrollment": "enrollment",
    "/policies": "policies",
    "/privacy": "privacy",
    "/reports": "reports",
    "/roster": "roster",
    "/support": "support",
    "/teacher": "teacher",
    "/guardian": "guardian",
    "/tenants": "tenants",
    "/timetable": "timetable",
    "/integrations": "integrations",
  };

  return (
    <div
      lang={locale}
      dir={locale === "ur" ? "rtl" : "ltr"}
      className="app-shell"
      style={
        {
          "--tenant-primary": tenant?.primaryColor ?? "#116b5f",
          "--tenant-accent": tenant?.accentColor ?? "#315f91",
        } as CSSProperties
      }
    >
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">
            {tenant?.logoUrl ? (
              <img alt="" src={tenant.logoUrl} />
            ) : (
              <BookOpenCheck size={22} strokeWidth={2.4} />
            )}
          </span>
          <span>
            <strong>{tenant?.name ?? "Virtual School"}</strong>
            <small>{tenant?.deviceLabel ?? "Device Management"}</small>
          </span>
        </Link>

        <nav className="sidebar-nav" aria-label={t("primary")}>
          {navigation.map((item) => {
            const Icon = navigationIcons[item.href];
            return (
              <Link href={item.href} key={item.href}>
                <Icon size={18} />
                <span>
                  {locale === "ur" ? t(navigationKeys[item.href]) : item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-status">
          <Boxes size={18} />
          <span>{tenant?.deviceLabel ?? "Android tablet"} fleet</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <span className="eyebrow">{t("schoolOperations")}</span>
            <h1>{tenant?.name ?? t("managedConsole")}</h1>
          </div>
          <div className="workspace-actions">
            <div className="tenant-switcher">
              <CalendarClock size={16} />
              <span>{tenant?.timezone ?? "No school selected"}</span>
            </div>
            {session ? (
              <div className="user-menu">
                <span>
                  <strong>{session.name}</strong>
                  <small>{roleLabels[session.role] ?? session.role}</small>
                  <small>{session.email}</small>
                </span>
                <a
                  aria-label={t("signOut")}
                  className="icon-action"
                  href={logoutHref()}
                >
                  <LogOut size={17} />
                </a>
              </div>
            ) : null}
            <form
              action={updateAdminLanguageAction}
              className="tenant-switcher"
            >
              <label htmlFor="admin-language">{t("language")}</label>
              <select id="admin-language" name="language" defaultValue="school">
                <option value="school">{t("useSchoolLanguage")}</option>
                <option value="en">{t("english")}</option>
                <option value="ur">{t("urdu")}</option>
              </select>
              <button type="submit">✓</button>
            </form>
          </div>
        </header>

        {connectionIssue ? (
          <section className="notice-band" role="status">
            <AlertTriangle size={18} />
            <span>{t("connectionIssue")}</span>
          </section>
        ) : null}

        {children}
      </main>

      <aside className="insight-rail" aria-label="Operations focus">
        <div className="rail-panel">
          <BarChart3 size={20} />
          <div>
            <strong>{t("dailyFocus")}</strong>
            <span>
              Enrollment, {tenant?.deviceLabel?.toLowerCase() ?? "device"}{" "}
              health, policy delivery, and learning access.
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
