export type CoreLocale = "en" | "ur";

export const coreEnglish = {
  primary: "Primary",
  schoolOperations: "School operations",
  managedConsole: "Managed learning console",
  signOut: "Sign out",
  dailyFocus: "Daily focus",
  language: "Language",
  useSchoolLanguage: "Use school language",
  english: "English",
  urdu: "Urdu",
  dashboard: "Dashboard",
  alerts: "Alerts",
  apps: "Apps and content",
  billing: "Billing",
  devices: "Devices",
  enrollment: "Enrollment",
  policies: "Policies",
  privacy: "Privacy",
  reports: "Reports",
  roster: "Roster",
  support: "Support",
  teacher: "Teacher",
  guardian: "Guardian",
  tenants: "Schools",
  timetable: "Timetable",
  integrations: "Integrations",
  connectionIssue:
    "The console could not refresh every data source. Existing screens remain available while the service reconnects.",
} as const;

type CoreKey = keyof typeof coreEnglish;

const ur: Record<CoreKey, string> = {
  primary: "بنیادی",
  schoolOperations: "اسکول کے امور",
  managedConsole: "تعلیمی انتظامی کنسول",
  signOut: "سائن آؤٹ",
  dailyFocus: "آج کی ترجیحات",
  language: "زبان",
  useSchoolLanguage: "اسکول کی زبان استعمال کریں",
  english: "انگریزی",
  urdu: "اردو",
  dashboard: "ڈیش بورڈ",
  alerts: "اطلاعات",
  apps: "ایپس اور مواد",
  billing: "بلنگ",
  devices: "آلات",
  enrollment: "اندراج",
  policies: "پالیسیاں",
  privacy: "رازداری",
  reports: "رپورٹس",
  roster: "طلبہ فہرست",
  support: "مدد",
  teacher: "استاد",
  guardian: "سرپرست",
  tenants: "اسکول",
  timetable: "نظام الاوقات",
  integrations: "انضمامات",
  connectionIssue:
    "کنسول تمام معلومات تازہ نہیں کر سکا۔ سروس دوبارہ منسلک ہونے تک موجودہ صفحات دستیاب رہیں گے۔",
};

export function coreText(locale: CoreLocale, key: CoreKey): string {
  return locale === "ur" ? (ur[key] ?? coreEnglish[key]) : coreEnglish[key];
}

export function supportedCoreLocale(value: unknown): CoreLocale {
  return value === "ur" ? "ur" : "en";
}

export function missingCoreTranslationKeys(locale: CoreLocale): CoreKey[] {
  if (locale === "en") return [];
  return (Object.keys(coreEnglish) as CoreKey[]).filter((key) => !ur[key]);
}
