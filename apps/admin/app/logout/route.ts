import { redirect } from "next/navigation";
import { signOutDevelopmentSession } from "../../lib/auth/session";

export async function GET(): Promise<never> {
  await signOutDevelopmentSession();
  redirect("/login");
}
