"use client";

import { useEffect, useState } from "react";
import type { LookingForGender, ProfileGender, UserDto } from "@soft-spark/shared";
import {
  GENDER_OPTIONS,
  INTENT_OPTIONS,
  LOOKING_FOR_GENDER_OPTIONS,
  PROFILE_CHIP_PRESETS,
} from "@soft-spark/shared";
import { PhotoCrop, SoftError } from "@soft-spark/ui";
import { ChipField } from "@/components/ChipField";
import { OnboardWizard } from "@/components/OnboardWizard";
import { PublishActions } from "@/components/PublishActions";
import { getBot, getMe, patchMe } from "@/lib/api";
import { CITY_NEIGHBORHOODS } from "@/lib/guest";
import { ensureGuestSession } from "@/lib/guest-session";
import { writeSession } from "@/lib/session";

export default function ProfilePage() {
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [published, setPublished] = useState(true);
  const [botName, setBotName] = useState("your bot");
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("29");
  const [gender, setGender] = useState<ProfileGender>("female");
  const [lookingForGender, setLookingForGender] = useState<LookingForGender>("male");
  const [bio, setBio] = useState("");
  const [height, setHeight] = useState("");
  const [hairColor, setHairColor] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [city, setCity] = useState("Denver");
  const [neighborhood, setNeighborhood] = useState("Capitol Hill");
  const [likes, setLikes] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [intent, setIntent] = useState("relationship");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function apply(user: UserDto) {
    setDisplayName(user.displayName);
    setAge(String(user.age));
    setGender((user.gender === "male" ? "male" : "female") as ProfileGender);
    setLookingForGender(user.lookingForGender ?? user.prefs.lookingForGender ?? "male");
    setBio(user.bio ?? "");
    setHeight(user.height ?? "");
    setHairColor(user.hairColor ?? "");
    setEyeColor(user.eyeColor ?? "");
    setCity(user.city ?? "Denver");
    setNeighborhood(user.neighborhood ?? "Capitol Hill");
    setLikes(user.likes ?? []);
    setDislikes(user.dislikes ?? []);
    setHobbies(user.hobbies.length ? user.hobbies : user.prefs.interests ?? []);
    setIntent(user.prefs.intent || user.prefs.lookingFor || "relationship");
    setPhotoUrl(user.photoUrl);
  }

  useEffect(() => {
    void (async () => {
      try {
        await ensureGuestSession();
        const user = await getMe();
        apply(user);
        writeSession({ id: user.id, displayName: user.displayName });
        try {
          const bot = await getBot();
          setPublished(Boolean(bot.publishedAt));
          setBotName(bot.displayName ?? `${user.displayName}'s bot`);
        } catch {
          setPublished(false);
        }
        setReady(true);
      } catch {
        setMissing(true);
        setReady(true);
      }
    })();
  }, []);

  async function save() {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const user = await patchMe({
        photoUrl,
        profile: {
          displayName: displayName.trim(),
          age: Number(age),
          gender,
          lookingForGender,
          interestedIn: lookingForGender === "both" ? ["male", "female"] : [lookingForGender],
          bio,
          height,
          hairColor,
          eyeColor,
          city,
          neighborhood,
          likes,
          dislikes,
          hobbies,
        },
        prefs: { intent, lookingFor: intent, lookingForGender, interests: hobbies },
      });
      apply(user);
      writeSession({ id: user.id, displayName: user.displayName });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p>Catching up…</p>;
  if (missing) return <OnboardWizard />;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 13, fontWeight: 600 }}>Profile</p>
      <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>Your dating profile</h1>
      <PhotoCrop name={displayName} value={photoUrl} onChange={setPhotoUrl} />
      <label style={{ display: "grid", gap: 6 }}>
        Your name
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        Age
        <input value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" />
      </label>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
        <legend style={{ fontWeight: 600 }}>Gender</legend>
        <div className="ss-chip-row">
          {GENDER_OPTIONS.map((g) => (
            <button key={g.id} type="button" className="ss-chip" aria-pressed={gender === g.id} onClick={() => setGender(g.id)}>
              {g.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
        <legend style={{ fontWeight: 600 }}>Looking for</legend>
        <div className="ss-chip-row">
          {LOOKING_FOR_GENDER_OPTIONS.map((g) => (
            <button
              key={g.id}
              type="button"
              className="ss-chip"
              aria-pressed={lookingForGender === g.id}
              onClick={() => setLookingForGender(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
        <legend style={{ fontWeight: 600 }}>Intent</legend>
        <div className="ss-chip-row">
          {INTENT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="ss-chip"
              aria-pressed={intent === opt.id}
              onClick={() => setIntent(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label style={{ display: "grid", gap: 6 }}>
        Bio
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} style={{ minHeight: 88, padding: 12 }} />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        Height
        <input value={height} onChange={(e) => setHeight(e.target.value)} placeholder={`5'7" or 170 cm`} />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        Hair color
        <input value={hairColor} onChange={(e) => setHairColor(e.target.value)} placeholder="dark brown" />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        Eye color
        <input value={eyeColor} onChange={(e) => setEyeColor(e.target.value)} placeholder="brown" />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        City
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Denver" />
      </label>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
        <legend style={{ fontWeight: 600 }}>Neighborhood</legend>
        <div className="ss-chip-row">
          {CITY_NEIGHBORHOODS.filter((row) => row.city === city).map((row) => (
            <button
              key={row.neighborhood}
              type="button"
              className="ss-chip"
              aria-pressed={neighborhood === row.neighborhood}
              onClick={() => setNeighborhood(row.neighborhood)}
            >
              {row.neighborhood}
            </button>
          ))}
        </div>
      </fieldset>
      <ChipField label="Likes" value={likes} presets={PROFILE_CHIP_PRESETS.likes} onChange={setLikes} />
      <ChipField label="Dislikes" value={dislikes} presets={PROFILE_CHIP_PRESETS.dislikes} onChange={setDislikes} />
      <ChipField label="Hobbies" value={hobbies} presets={PROFILE_CHIP_PRESETS.hobbies} onChange={setHobbies} />
      {error ? <SoftError>{error}</SoftError> : null}
      {saved ? <p style={{ margin: 0, color: "var(--ss-success)" }}>Profile saved</p> : null}
      <button type="button" className="ss-btn ss-btn-primary" disabled={busy} onClick={() => void save()}>
        Save profile
      </button>
      {published ? null : (
        <div style={{ paddingTop: 8 }}>
          <PublishActions botName={botName} />
        </div>
      )}
    </div>
  );
}
