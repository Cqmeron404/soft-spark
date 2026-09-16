"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TabBar, TabVisual, type TabItem } from "@soft-spark/ui";
import { PushOptIn } from "@/components/PushOptIn";
import { SessionBar } from "@/components/SessionBar";

const TABS: Array<Omit<TabItem, "current">> = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/create", label: "Create", icon: "create" },
  { href: "/profile", label: "Profile", icon: "profile" },
  { href: "/matches", label: "Roam", icon: "roam" },
];

function isAuthPath(pathname: string) {
  return pathname.startsWith("/auth/") || pathname === "/signin" || pathname === "/signup";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideTabs = isAuthPath(pathname);

  return (
    <div className="ss-app-stage">
      <div className="ss-phone">
        <SessionBar />
        <main className="ss-phone-body">
          {children}
          <PushOptIn />
        </main>
        {hideTabs ? null : (
          <TabBar
            items={TABS.map((tab) => ({
              ...tab,
              current: tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href),
            }))}
            renderLink={(item) => (
              <Link
                key={item.href}
                href={item.href}
                className="ss-tab"
                aria-current={item.current ? "page" : undefined}
              >
                <TabVisual item={item} />
              </Link>
            )}
          />
        )}
      </div>
    </div>
  );
}
