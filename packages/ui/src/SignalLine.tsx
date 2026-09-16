import { signalLinesFor } from "@soft-spark/shared";
import { tokens } from "./tokens";

export function SignalLine({ reasons }: { reasons: string[] }) {
  const lines = signalLinesFor(reasons, 2);
  if (lines.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {lines.map((line) => (
        <p
          key={line}
          style={{
            margin: 0,
            color: tokens.textMuted,
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.3,
          }}
        >
          {line}
        </p>
      ))}
    </div>
  );
}
