"use server";

import { redirect } from "next/navigation";
import {
  signInDevelopmentSession,
  signOutDevelopmentSession,
} from "./session";

export async function signInAction(): Promise<void> {
  await signInDevelopmentSession();
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await signOutDevelopmentSession();
  redirect("/login");
}
