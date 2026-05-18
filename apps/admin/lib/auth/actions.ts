"use server";

import { redirect } from "next/navigation";
import {
  type DevelopmentSessionInput,
  signInDevelopmentSession,
  signOutDevelopmentSession,
} from "./session";

export async function signInAction(formData: FormData): Promise<void> {
  const email = formValue(formData, "email");
  const password = formValue(formData, "password");

  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const input: DevelopmentSessionInput = {
    email,
    name: formValue(formData, "name"),
    role: formValue(formData, "role"),
    tenantIds: formValue(formData, "tenantIds") ?? "*",
  };

  await signInDevelopmentSession(input);
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await signOutDevelopmentSession();
  redirect("/login");
}

function formValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
