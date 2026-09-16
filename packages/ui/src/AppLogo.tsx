"use client";

import { BRAND_ASSETS, PRODUCT_NAME } from "./brand";

export type AppLogoVariant = "mark" | "wordmark" | "favicon" | "lockup";

export function AppLogo(props: {
  variant?: AppLogoVariant;
  onDark?: boolean;
  size?: number;
  alt?: string;
}) {
  const variant = props.variant ?? "mark";
  const src =
    variant === "wordmark"
      ? BRAND_ASSETS.wordmark
      : variant === "lockup"
        ? BRAND_ASSETS.lockup
        : variant === "favicon"
          ? BRAND_ASSETS.favicon
          : props.onDark
            ? BRAND_ASSETS.markOnDark
            : BRAND_ASSETS.markTransparent;
  const height =
    props.size ??
    (variant === "lockup" ? 96 : variant === "wordmark" ? 48 : variant === "favicon" ? 32 : 24);
  const width =
    variant === "wordmark"
      ? Math.round((height * 840) / 400)
      : variant === "lockup"
        ? Math.round((height * 1200) / 743)
        : height;
  return (
    <img
      src={src}
      alt={props.alt ?? PRODUCT_NAME}
      width={width}
      height={height}
      style={{
        display: "block",
        width,
        height,
        borderRadius: variant === "wordmark" || variant === "lockup" ? 0 : 8,
        objectFit: "contain",
      }}
    />
  );
}

/** SessionBar chrome: Ember mark 24px + Soft Spark word (never “Spark” alone). */
export function BrandMark({ href = "/" }: { href?: string }) {
  return (
    <a
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        color: "inherit",
        textDecoration: "none",
        minHeight: 24,
      }}
    >
      <AppLogo variant="mark" size={24} alt="" />
      <span style={{ fontFamily: "var(--ss-font-display)", fontWeight: 600, fontSize: 18 }}>
        {PRODUCT_NAME}
      </span>
    </a>
  );
}
