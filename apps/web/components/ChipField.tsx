"use client";

import { useState } from "react";
import { normalizeTagList } from "@soft-spark/shared";

export function ChipField(props: {
  label: string;
  hint?: string;
  value: string[];
  presets?: readonly string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function add(tag: string) {
    props.onChange(normalizeTagList([...props.value, tag]));
    setDraft("");
  }

  function toggle(tag: string) {
    const on = props.value.some((v) => v.toLowerCase() === tag.toLowerCase());
    props.onChange(
      on ? props.value.filter((v) => v.toLowerCase() !== tag.toLowerCase()) : normalizeTagList([...props.value, tag])
    );
  }

  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
      <legend style={{ fontWeight: 600 }}>{props.label}</legend>
      {props.hint ? <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 13 }}>{props.hint}</p> : null}
      <div className="ss-chip-row">
        {(props.presets ?? []).map((tag) => (
          <button
            key={tag}
            type="button"
            className="ss-chip"
            aria-pressed={props.value.some((v) => v.toLowerCase() === tag.toLowerCase())}
            onClick={() => toggle(tag)}
          >
            {tag}
          </button>
        ))}
        {props.value
          .filter((tag) => !(props.presets ?? []).some((p) => p.toLowerCase() === tag.toLowerCase()))
          .map((tag) => (
            <button key={tag} type="button" className="ss-chip ss-chip-on" onClick={() => toggle(tag)}>
              {tag}
            </button>
          ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={draft}
          style={{ flex: 1 }}
          placeholder={props.placeholder ?? "Add your own"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (draft.trim()) add(draft);
            }
          }}
        />
        <button type="button" className="ss-btn ss-btn-ghost" disabled={!draft.trim()} onClick={() => add(draft)}>
          Add
        </button>
      </div>
    </fieldset>
  );
}
