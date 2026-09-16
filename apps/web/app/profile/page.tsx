"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserDto } from "@soft-spark/shared";
import { PROFILE_CHIP_PRESETS } from "@soft-spark/shared";
import { PhotoCrop, SoftError } from "@soft-spark/ui";
import { ChipField } from "@/components/ChipField";
import { PublishActions } from "@/components/PublishActions";
import { getBot, getMe, patchMe } from "@/lib/api";
import { getAuthSession } from "@/lib/auth";
import { CITY_NEIGHBORHOODS, GENDER_OPTIONS, LOOKING_OPTIONS } from "@/lib/guest";
import { writeSession } from "@/lib/session";

export default function ProfilePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [published, setPublished] = useState(true);
  const [botName, setBotName] = useState("your bot");
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("29");
  const [gender, setGender] = useState("woman");
  const [interestedIn, setInterestedIn] = useState("man");
  const [bio, setBio] = useState("");
  const [height, setHeight] = useState("");
  const [hairColor, setHairColor] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [city, setCity] = useState("Denver");
  const [neighborhood, setNeighborhood] = useState("Capitol Hill");
  const [likes, setLikes] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [lookingFor, setLookingFor] = useState("relationship");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function apply(user: UserDto) {
    setDisplayName(user.displayName);
    setAge(String(user.age));
    setGender(user.gender);
    setInterestedIn(user.interestedIn[0] ?? "man");
    setBio(user.bio ?? "");
    setHeight(user.height ?? "");
    setHairColor(user.hairColor ?? "");
    setEyeColor(user.eyeColor ?? "");
    setCity(user.city ?? "Denver");
    setNeighborhood(user.neighborhood ?? "Capitol Hill");
    setLikes(user.likes ?? []);
    setDislikes(user.dislikes ?? []);
    setHobbies(user.hobbies.length ? user.hobbies : user.prefs.interests ?? []);
    setLookingFor(user.prefs.lookingFor || "relationship");
    setPhotoUrl(user.photoUrl);
  }

  useEffect(() => {
    void (async () => {
      const session = await getAuthSession();
      if (!session?.user) {
        router.replace("/auth/sign-in");
        return;
      }
      try {
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
        router.replace("/onboard");
      }
    })();
  }, [router]);

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
          interestedIn: [interestedIn],
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
        prefs: { lookingFor, interests: hobbies },
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
        <legend style={{ fontWeight: 600 }}>I am</legend>
        <div className="ss-chip-row">
          {GENDER_OPTIONS.map((g) => (
            <button key={g} type="button" className="ss-chip" aria-pressed={gender === g} onClick={() => setGender(g)}>
              {g}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
        <legend style={{ fontWeight: 600 }}>Interested in</legend>
        <div className="ss-chip-row">
          {GENDER_OPTIONS.map((g) => (
            <button
              key={g}
              type="button"
              className="ss-chip"
              aria-pressed={interestedIn === g}
              onClick={() => setInterestedIn(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
        <legend style={{ fontWeight: 600 }}>Looking for</legend>
        <div className="ss-chip-row">
          {LOOKING_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="ss-chip"
              aria-pressed={lookingFor === opt.id}
              onClick={() => setLookingFor(opt.id)}
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
