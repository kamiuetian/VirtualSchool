import { cookies } from "next/headers";
import { supportedCoreLocale, type CoreLocale } from "./core-i18n";

export const adminLocaleCookie = "vs_admin_locale";

export async function resolveAdminLocale(
  tenantLanguage?: string,
): Promise<CoreLocale> {
  const override = (await cookies()).get(adminLocaleCookie)?.value;
  return supportedCoreLocale(
    override === "school" || !override ? tenantLanguage : override,
  );
}
