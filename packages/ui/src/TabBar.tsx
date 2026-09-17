"use client";

import type { ReactNode } from "react";

export type TabItem = {
  href: string;
  label: string;
  icon: "home" | "create" | "profile" | "roam";
  current?: boolean;
};

function TabIcon({ name }: { name: TabItem["icon"] }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "home") {
    return (
      <svg {...common} aria-hidden>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
      </svg>
    );
  }
  if (name === "create") {
    return (
      <svg {...common} aria-hidden>
        <path d="M12 5v14M5 12h14" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  if (name === "profile") {
    return (
      <svg {...common} aria-hidden>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 19.2c1.4-3 4-4.7 7-4.7s5.6 1.7 7 4.7" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20M6.4 6.4l1.6 1.6M16 16l1.6 1.6M17.6 6.4 16 8M8 16l-1.6 1.6" />
    </svg>
  );
}

export function TabBar(props: { items: TabItem[]; renderLink: (item: TabItem) => ReactNode }) {
  return (
    <nav className="ss-tabbar" aria-label="App">
      {props.items.map((item) => props.renderLink(item))}
    </nav>
  );
}

export function TabVisual({ item }: { item: TabItem }) {
  return (
    <>
      <span className="ss-tab-icon">
        <TabIcon name={item.icon} />
      </span>
      {item.label}
    </>
  );
}
