import { redirect } from "next/navigation";

export default function LegacySignIn() {
  redirect("/auth/sign-in");
}
