import { redirect } from "next/navigation";

export default function LegacySignUp() {
  redirect("/auth/sign-up");
}
