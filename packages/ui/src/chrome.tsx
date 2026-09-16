"use client";

import { useState } from "react";

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

export function EmptyState(props: { title: string; body?: string }) {
  return (
    <div className="ss-card" style={{ display: "grid", gap: 8 }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{props.title}</p>
      {props.body ? <p style={{ margin: 0, color: "var(--ss-text-muted)" }}>{props.body}</p> : null}
    </div>
  );
}

export function SoftError({ children }: { children: string }) {
  return (
    <p className="ss-error" role="alert">
      {children}
    </p>
  );
}

export function PhotoCrop(props: {
  name: string;
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
}) {
  const [nudge, setNudge] = useState(false);
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
          backgroundColor: props.value ? "#FFF8F2" : "#E8A598",
          border: "4px solid #E8A598",
          boxShadow: "0 0 0 4px #FFF8F2",
          backgroundImage: props.value ? `url(${props.value})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {props.value ? null : initials}
      </div>
      <p style={{ margin: 0, fontWeight: 600, textAlign: "center" }}>
        Add a photo so your invite feels human
      </p>
      <p style={{ margin: 0, color: "var(--ss-text-muted)", textAlign: "center", fontSize: 14 }}>
        Soft circle crop · cream frame · coral blush ring
      </p>
      <label className="ss-btn ss-btn-primary" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
        Choose photo
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void cropToCircle(file).then((url) => {
              props.onChange(url);
              setNudge(false);
            });
            e.target.value = "";
          }}
        />
      </label>
      <button
        type="button"
        className="ss-btn ss-btn-ghost"
        onClick={() => {
          props.onChange(undefined);
          setNudge(true);
        }}
      >
        Use initials for now
      </button>
      {nudge && !props.value ? (
        <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 13, textAlign: "center" }}>
          A photo makes the invite warmer
        </p>
      ) : null}
    </div>
  );
}

async function cropToCircle(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - size) / 2;
    const sy = (bitmap.height - size) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.beginPath();
    ctx.arc(180, 180, 180, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, 360, 360);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.88);
  } catch {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
