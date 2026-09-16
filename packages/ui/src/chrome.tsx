"use client";

export function ConnectingCaption({ live }: { live: boolean }) {
  if (live) return null;
  return (
    <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 13 }}>Catching up…</p>
  );
}

export function SoftToast(props: { message: string; action?: string; onAction?: () => void; onDismiss?: () => void }) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        borderRadius: 14,
        background: "var(--ss-surface-elevated)",
        border: "1px solid var(--ss-border)",
      }}
    >
      <span>{props.message}</span>
      {props.action ? (
        <button type="button" className="ss-btn ss-btn-ghost" onClick={props.onAction} style={{ minHeight: 36 }}>
          {props.action}
        </button>
      ) : null}
    </div>
  );
}

/** Aura can drop SVG/PNG into /brand/logo.svg and /brand/logo.png — this slot does not block eng. */
export function BrandMark({ href = "/matches" }: { href?: string }) {
  return (
    <a href={href} style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "inherit", textDecoration: "none" }}>
      <img
        src="/brand/logo.svg"
        alt=""
        width={28}
        height={28}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
        style={{ borderRadius: 8 }}
      />
      <span style={{ fontFamily: "var(--ss-font-display)", fontWeight: 600, fontSize: 18 }}>Soft spark</span>
    </a>
  );
}

export function PhotoCrop(props: {
  name: string;
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
}) {
  const initials = props.name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: 999,
          overflow: "hidden",
          background: "#E8A598",
          color: "#2A211C",
          display: "grid",
          placeItems: "center",
          fontSize: 42,
          fontWeight: 600,
          border: "4px solid #FFF8F2",
          backgroundImage: props.value ? `url(${props.value})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {props.value ? null : initials}
      </div>
      <p style={{ margin: 0, color: "var(--ss-text-muted)", textAlign: "center" }}>
        Add a photo so your invite feels human
      </p>
      <label className="ss-btn ss-btn-ghost" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
        Choose photo
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => props.onChange(String(reader.result));
            reader.readAsDataURL(file);
          }}
        />
      </label>
      <button type="button" className="ss-btn ss-btn-ghost" onClick={() => props.onChange(undefined)}>
        Skip for now
      </button>
    </div>
  );
}
