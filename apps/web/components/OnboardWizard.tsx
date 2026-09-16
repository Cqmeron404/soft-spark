"use client";

import { useState } from "react";
import type { OnboardBody } from "@soft-spark/shared";
import { PROFILE_CHIP_PRESETS } from "@soft-spark/shared";
import { PhotoCrop, SoftError } from "@soft-spark/ui";
import { ChipField } from "@/components/ChipField";
import { PublishActions } from "@/components/PublishActions";
import { onboard } from "@/lib/api";
import { DEFAULT_VIBES, DENVER_HOME, GENDER_OPTIONS, LOOKING_OPTIONS } from "@/lib/guest";
import { writeSession } from "@/lib/session";

type Step = "bot" | "profile" | "publish";

export function OnboardWizard(props: { defaultName?: string }) {
  const [step, setStep] = useState<Step>("bot");
  const [botName, setBotName] = useState("");
  const [vibeTags, setVibeTags] = useState<string[]>(["Curious"]);
  const [displayName, setDisplayName] = useState(props.defaultName ?? "");
  const [age, setAge] = useState("29");
  const [gender, setGender] = useState("woman");
  const [interestedIn, setInterestedIn] = useState("man");
  const [bio, setBio] = useState("");
  const [height, setHeight] = useState("");
  const [hairColor, setHairColor] = useState("");
  const [likes, setLikes] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [lookingFor, setLookingFor] = useState("relationship");
  const [job, setJob] = useState("");
  const [education, setEducation] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleVibe(v: string) {
    setVibeTags((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }

  async function saveProfile() {
    setError(null);
    if (!botName.trim()) {
      setError("Name your bot to continue");
      setStep("bot");
      return;
    }
    if (!displayName.trim() || !Number(age)) {
      setError("Add your name and age");
      return;
    }
    setBusy(true);
    try {
      const body: OnboardBody = {
        botDatingOptIn: true,
        botName: botName.trim(),
        vibeTags,
        photoUrl,
        profile: {
          displayName: displayName.trim(),
          age: Number(age),
          gender,
          interestedIn: [interestedIn],
          bio: bio.trim() || undefined,
          height: height.trim() || undefined,
          hairColor: hairColor.trim() || undefined,
          likes,
          dislikes,
          job: job.trim() || undefined,
          education: education.trim() || undefined,
        },
        prefs: {
          cuisine: ["italian", "american"],
          budget: 3,
          maxTravelKm: 25,
          dealbreakers: [],
          lookingFor,
          interests: hobbies,
        },
        homeGeo: { ...DENVER_HOME },
        homeTz: "America/Denver",
      };
      const res = await onboard(body);
      writeSession({ id: res.user.id, displayName: res.user.displayName });
      setStep("publish");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setBusy(false);
    }
  }

  if (step === "publish") {
    return <PublishActions botName={botName} />;
  }

  if (step === "bot") {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 13, fontWeight: 600 }}>1 of 3</p>
        <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0, lineHeight: 1.15 }}>
          Name your dating bot
        </h1>
        <p style={{ margin: 0, color: "var(--ss-text-muted)", lineHeight: 1.45 }}>
          They’ll explore chemistry for you. You only show up when there’s a real invite.
        </p>
        <label style={{ display: "grid", gap: 6 }}>
          Bot name
          <input
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            placeholder="Ember"
            autoComplete="off"
          />
        </label>
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
          <legend style={{ fontWeight: 600 }}>Vibe</legend>
          <div className="ss-chip-row">
            {DEFAULT_VIBES.map((v) => (
              <button
                key={v}
                type="button"
                className="ss-chip"
                aria-pressed={vibeTags.includes(v)}
                onClick={() => toggleVibe(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </fieldset>
        {error ? <SoftError>{error}</SoftError> : null}
        <button
          type="button"
          className="ss-btn ss-btn-primary"
          onClick={() => {
            if (!botName.trim()) {
              setError("Name your bot to continue");
              return;
            }
            setError(null);
            setStep("profile");
          }}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 13, fontWeight: 600 }}>2 of 3</p>
      <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>Your profile</h1>
      <p style={{ margin: 0, color: "var(--ss-text-muted)" }}>
        Dating-app basics {botName.trim() ? `so ${botName.trim()} knows who you are` : "for your bot"}.
      </p>
      <PhotoCrop name={displayName} value={photoUrl} onChange={setPhotoUrl} />
      <label style={{ display: "grid", gap: 6 }}>
        Your name
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
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
        <input
          value={hairColor}
          onChange={(e) => setHairColor(e.target.value)}
          placeholder="dark brown"
          list="ss-hair"
        />
        <datalist id="ss-hair">
          {PROFILE_CHIP_PRESETS.hairColor.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        Job
        <input value={job} onChange={(e) => setJob(e.target.value)} placeholder="product designer" />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        Education
        <input value={education} onChange={(e) => setEducation(e.target.value)} placeholder="CU Boulder" />
      </label>
      <ChipField
        label="Likes"
        value={likes}
        presets={PROFILE_CHIP_PRESETS.likes}
        onChange={setLikes}
        placeholder="Add a like"
      />
      <ChipField
        label="Dislikes"
        value={dislikes}
        presets={PROFILE_CHIP_PRESETS.dislikes}
        onChange={setDislikes}
        placeholder="Add a dislike"
      />
      <ChipField
        label="Hobbies"
        hint="Saved as interests for matching."
        value={hobbies}
        presets={PROFILE_CHIP_PRESETS.hobbies}
        onChange={setHobbies}
        placeholder="Add a hobby"
      />
      {error ? <SoftError>{error}</SoftError> : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="ss-btn ss-btn-ghost" onClick={() => setStep("bot")}>
          Back
        </button>
        <button type="button" className="ss-btn ss-btn-primary" disabled={busy} onClick={() => void saveProfile()}>
          Continue
        </button>
      </div>
    </div>
  );
}
