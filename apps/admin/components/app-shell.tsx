import {
  AlertTriangle,
  AppWindow,
  BarChart3,
  BookOpenCheck,
  Boxes,
  CalendarClock,
  GraduationCap,
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
import type { ReactNode } from "react";
import type { TenantSummary } from "@virtual-school/shared";
import {
  type PortalHref,
  visiblePortalNavigation,
} from "../lib/auth/portal-access";
import { getAdminSession, logoutHref } from "../lib/auth/session";

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
  "/tenants": GraduationCap,
  "/timetable": CalendarClock,
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
};

export async function AppShell({
  children,
  connectionIssue,
  tenant,
}: {
  children: ReactNode;
  connectionIssue?: boolean;
  tenant: TenantSummary | null;
}) {
  const session = await getAdminSession();
  const navigation = session ? visiblePortalNavigation(session.role) : [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <BookOpenCheck size={22} strokeWidth={2.4} />
          </span>
          <span>
            <strong>Virtual School</strong>
            <small>Device Management</small>
          </span>
        </Link>

        <nav className="sidebar-nav" aria-label="Primary">
          {navigation.map((item) => {
            const Icon = navigationIcons[item.href];
            return (
              <Link href={item.href} key={item.href}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-status">
          <Boxes size={18} />
          <span>Android tablet fleet</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <span className="eyebrow">School operations</span>
            <h1>{tenant?.name ?? "Managed learning console"}</h1>
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
                  aria-label="Sign out"
                  className="icon-action"
                  href={logoutHref()}
                >
                  <LogOut size={17} />
                </a>
              </div>
            ) : null}
          </div>
        </header>

        {connectionIssue ? (
          <section className="notice-band" role="status">
            <AlertTriangle size={18} />
            <span>
              The console could not refresh every data source. Existing screens
              remain available while the service reconnects.
            </span>
          </section>
        ) : null}

        {children}
      </main>

      <aside className="insight-rail" aria-label="Operations focus">
        <div className="rail-panel">
          <BarChart3 size={20} />
          <div>
            <strong>Daily focus</strong>
            <span>
              Enrollment, device health, policy delivery, and learning access.
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
