"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OnboardBody } from "@soft-spark/shared";
import { PhotoCrop } from "@soft-spark/ui";
import { onboard } from "@/lib/api";
import { getAuthSession } from "@/lib/auth";
import { writeSession } from "@/lib/session";

const MAYA: OnboardBody = {
  botDatingOptIn: true,
  profile: {
    displayName: "Maya",
    age: 29,
    gender: "woman",
    interestedIn: ["man"],
    bio: "Denver nights, italian food",
  },
  prefs: {
    cuisine: ["italian", "american"],
    budget: 3,
    maxTravelKm: 25,
    dealbreakers: [],
    lookingFor: "relationship",
    interests: ["food", "hiking", "live music"],
  },
  homeGeo: { lat: 39.739, lng: -104.979 },
  homeTz: "America/Denver",
  vibeTags: ["Curious", "Soft"],
};

const JORDAN: OnboardBody = {
  botDatingOptIn: true,
  profile: {
    displayName: "Jordan",
    age: 31,
    gender: "man",
    interestedIn: ["woman"],
    bio: "LoHi, long walks, pasta",
  },
  prefs: {
    cuisine: ["italian", "american"],
    budget: 3,
    maxTravelKm: 20,
    dealbreakers: [],
    lookingFor: "relationship",
    interests: ["food", "hiking", "design"],
  },
  homeGeo: { lat: 39.759, lng: -104.999 },
  homeTz: "America/Denver",
  vibeTags: ["Curious", "Witty"],
};

const VIBES = ["Curious", "Bold", "Soft", "Witty"] as const;

export default function OnboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [optIn, setOptIn] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("29");
  const [gender, setGender] = useState("woman");
  const [interestedIn, setInterestedIn] = useState("man");
  const [vibeTags, setVibeTags] = useState<string[]>(["Curious"]);
  const [maxTravelKm, setMaxTravelKm] = useState("25");
  const [lat, setLat] = useState("39.739");
  const [lng, setLng] = useState("-104.979");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getAuthSession().then((data) => {
      if (!data?.user) {
        router.replace("/auth/sign-in");
        return;
      }
      if (!name) setName(data.user.name ?? "");
      setReady(true);
    });
  }, [router]);

  function apply(preset: OnboardBody) {
    setName(preset.profile.displayName);
    setAge(String(preset.profile.age));
    setGender(preset.profile.gender);
    setInterestedIn(preset.profile.interestedIn[0] ?? "");
    setVibeTags(preset.vibeTags ?? []);
    setMaxTravelKm(String(preset.prefs.maxTravelKm));
    setLat(String(preset.homeGeo.lat));
    setLng(String(preset.homeGeo.lng));
    setOptIn(true);
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const body: OnboardBody = {
        botDatingOptIn: optIn,
        profile: {
          displayName: name,
          age: Number(age),
          gender,
          interestedIn: [interestedIn],
        },
        prefs: {
          cuisine: ["italian", "american"],
          budget: 3,
          maxTravelKm: Number(maxTravelKm),
          dealbreakers: [],
          lookingFor: "relationship",
          interests: ["food", "hiking"],
        },
        homeGeo: { lat: Number(lat), lng: Number(lng) },
        homeTz: "America/Denver",
        vibeTags,
        photoUrl,
      };
      const res = await onboard(body);
      writeSession({ id: res.user.id, displayName: res.user.displayName });
      router.push("/matches");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not onboard");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p>Catching up…</p>;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 32, margin: 0 }}>
        Let’s build your dating bot
      </h1>
      <p style={{ color: "var(--ss-text-muted)", margin: 0 }}>
        It’ll explore chemistry for you — you only show up when there’s a real invite
      </p>
      <PhotoCrop name={name} value={photoUrl} onChange={setPhotoUrl} />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="ss-btn ss-btn-ghost" onClick={() => apply(MAYA)}>
          Fill Maya
        </button>
        <button type="button" className="ss-btn ss-btn-ghost" onClick={() => apply(JORDAN)}>
          Fill Jordan
        </button>
      </div>
      <label style={{ display: "grid", gap: 6 }}>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        Age
        <input value={age} onChange={(e) => setAge(e.target.value)} />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        Gender
        <input value={gender} onChange={(e) => setGender(e.target.value)} />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        Interested in
        <input value={interestedIn} onChange={(e) => setInterestedIn(e.target.value)} />
      </label>
      <fieldset style={{ border: 0, padding: 0, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <legend>Vibe</legend>
        {VIBES.map((v) => {
          const on = vibeTags.includes(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() =>
                setVibeTags(on ? vibeTags.filter((x) => x !== v) : [...vibeTags, v])
              }
              style={{
                minHeight: 36,
                borderRadius: 999,
                border: "1px solid var(--ss-border)",
                background: on ? "var(--ss-accent-soft)" : "var(--ss-surface)",
                padding: "0 12px",
              }}
            >
              {v}
            </button>
          );
        })}
      </fieldset>
      <label style={{ display: "grid", gap: 6 }}>
        Max travel (km)
        <input value={maxTravelKm} onChange={(e) => setMaxTravelKm(e.target.value)} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ display: "grid", gap: 6 }}>
          Home lat
          <input value={lat} onChange={(e) => setLat(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          Home lng
          <input value={lng} onChange={(e) => setLng(e.target.value)} />
        </label>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
        I want an AI bot to date on my behalf
      </label>
      {error ? <p style={{ color: "var(--ss-danger)" }}>{error}</p> : null}
      <button type="button" className="ss-btn ss-btn-primary" disabled={busy} onClick={() => void submit()}>
        Continue
      </button>
    </div>
  );
}
