import { redirect } from "next/navigation";
import { ROAM_HREF } from "@/lib/nav";

export default function RoamAlias() {
  redirect(ROAM_HREF);
}
