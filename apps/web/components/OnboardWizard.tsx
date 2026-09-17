"use client";

import { useState } from "react";
import type { LookingForGender, OnboardBody, ProfileGender } from "@soft-spark/shared";
import {
  GENDER_OPTIONS,
  INTENT_OPTIONS,
  LOOKING_FOR_GENDER_OPTIONS,
  PROFILE_CHIP_PRESETS,
  TRAVEL_MILE_OPTIONS,
  VIBE_LINE_MAX,
} from "@soft-spark/shared";
import { PhotoCrop, SoftError } from "@soft-spark/ui";
import { ChipField } from "@/components/ChipField";
import { PublishActions } from "@/components/PublishActions";
import { onboard } from "@/lib/api";
import { CITY_NEIGHBORHOODS, DEFAULT_CITY, geoForPlace } from "@/lib/guest";
import { writeSession } from "@/lib/session";

type Step = "bot" | "look" | "taste" | "prefs" | "home" | "review";
const STEPS: Step[] = ["bot", "look", "taste", "prefs", "home", "review"];

export function OnboardWizard(props: { defaultName?: string }) {
  const [step, setStep] = useState<Step>("bot");
  const [botDisplayName, setBotDisplayName] = useState("");
  const [vibeLine, setVibeLine] = useState("");
  const [styleTags, setStyleTags] = useState<string[]>(["Curious"]);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [height, setHeight] = useState("");
  const [hair, setHair] = useState("");
  const [eyes, setEyes] = useState("");
  const [likes, setLikes] = useState<string[]>([]);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [dealbreakers, setDealbreakers] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState(props.defaultName ?? "");
  const [age, setAge] = useState("29");
  const [gender, setGender] = useState<ProfileGender>("female");
  const [lookingForGender, setLookingForGender] = useState<LookingForGender>("male");
  const [intent, setIntent] = useState("relationship");
  const [ageRangeMin, setAgeRangeMin] = useState("25");
  const [ageRangeMax, setAgeRangeMax] = useState("40");
  const [cuisine, setCuisine] = useState<string[]>(["italian"]);
  const [budget, setBudget] = useState<1 | 2 | 3 | 4>(3);
  const [botDatingOptIn, setBotDatingOptIn] = useState(false);
  const [city, setCity] = useState<string>(DEFAULT_CITY.city);
  const [neighborhood, setNeighborhood] = useState<string>(DEFAULT_CITY.neighborhood);
  const [maxTravelMiles, setMaxTravelMiles] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  function toggleStyle(tag: string) {
    setStyleTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]));
  }

  function nextFrom(current: Step) {
    setError(null);
    if (current === "bot" && !botDisplayName.trim()) {
      setError("Name your bot to continue");
      return;
    }
    if (current === "taste") {
      if (likes.length < 1 || hobbies.length < 1) {
        setError("Add at least one like and one hobby");
        return;
      }
    }
    if (current === "prefs") {
      if (!displayName.trim() || !Number(age)) {
        setError("Add your name and age");
        return;
      }
      if (!cuisine.length) {
        setError("Pick at least one cuisine");
        return;
      }
      if (!botDatingOptIn) {
        setError("I want an AI bot to date on my behalf");
        return;
      }
    }
    setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)]!);
  }

  async function saveAndReview() {
    setError(null);
    if (!botDisplayName.trim()) {
      setError("Name your bot to continue");
      setStep("bot");
      return;
    }
    if (likes.length < 1 || hobbies.length < 1) {
      setError("Add at least one like and one hobby");
      setStep("taste");
      return;
    }
    if (!botDatingOptIn) {
      setError("I want an AI bot to date on my behalf");
      setStep("prefs");
      return;
    }
    setBusy(true);
    try {
      const place = geoForPlace(city, neighborhood);
      const body: OnboardBody = {
        botDatingOptIn: true,
        botDisplayName: botDisplayName.trim(),
        botName: botDisplayName.trim(),
        vibeLine: vibeLine.trim() || undefined,
        styleTags,
        vibeTags: styleTags,
        photoUrl,
        profile: {
          displayName: displayName.trim() || "You",
          age: Number(age) || 29,
          gender,
          lookingForGender,
          interestedIn: lookingForGender === "both" ? ["male", "female"] : [lookingForGender],
          height: height.trim() || undefined,
          hair: hair.trim() || undefined,
          hairColor: hair.trim() || undefined,
          eyes: eyes.trim() || undefined,
          eyeColor: eyes.trim() || undefined,
          city,
          neighborhood,
          likes,
          dislikes,
          hobbies,
        },
        prefs: {
          cuisine: cuisine.length ? cuisine : ["italian"],
          budget,
          maxTravelMiles,
          dealbreakers,
          intent,
          lookingForGender,
          ageRangeMin: Number(ageRangeMin) || undefined,
          ageRangeMax: Number(ageRangeMax) || undefined,
          interests: hobbies,
        },
        homeGeo: { lat: place.lat, lng: place.lng },
        homeTz: "America/Denver",
      };
      const res = await onboard(body);
      writeSession({ id: res.user.id, displayName: res.user.displayName });
      setSaved(true);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="ss-progress-dots" aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}>
        {STEPS.map((id, i) => (
          <span key={id} className="ss-progress-dot" data-on={i <= stepIndex ? "true" : "false"} />
        ))}
      </div>

      {step === "bot" ? (
        <>
          <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0, lineHeight: 1.15 }}>
            Name your bot
          </h1>
          <p style={{ margin: 0, color: "var(--ss-text-muted)", lineHeight: 1.45 }}>
            It’ll explore chemistry for you — you only show up when there’s a real invite
          </p>
          <label style={{ display: "grid", gap: 6 }}>
            Bot name
            <input
              value={botDisplayName}
              onChange={(e) => setBotDisplayName(e.target.value)}
              placeholder="Ember"
              autoComplete="off"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Vibe line
            <input
              value={vibeLine}
              maxLength={VIBE_LINE_MAX}
              onChange={(e) => setVibeLine(e.target.value.slice(0, VIBE_LINE_MAX))}
              placeholder="Optional · 80 characters"
            />
          </label>
        </>
      ) : null}

      {step === "look" ? (
        <>
          <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>Look</h1>
          <PhotoCrop name={displayName || botDisplayName} value={photoUrl} onChange={setPhotoUrl} />
          <label style={{ display: "grid", gap: 6 }}>
            Height
            <input value={height} onChange={(e) => setHeight(e.target.value)} placeholder={`5'7" or 170 cm`} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Hair
            <input value={hair} onChange={(e) => setHair(e.target.value)} placeholder="dark brown" list="ss-hair" />
            <datalist id="ss-hair">
              {PROFILE_CHIP_PRESETS.hairColor.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Eyes
            <input value={eyes} onChange={(e) => setEyes(e.target.value)} placeholder="brown" list="ss-eyes" />
            <datalist id="ss-eyes">
              {PROFILE_CHIP_PRESETS.eyeColor.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <legend style={{ fontWeight: 600 }}>Style</legend>
            <div className="ss-chip-row">
              {PROFILE_CHIP_PRESETS.styleTags.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="ss-chip"
                  aria-pressed={styleTags.includes(v)}
                  onClick={() => toggleStyle(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}

      {step === "taste" ? (
        <>
          <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>Taste</h1>
          <ChipField label="Likes" hint="Pick at least one" value={likes} presets={PROFILE_CHIP_PRESETS.likes} onChange={setLikes} />
          <ChipField label="Hobbies" hint="Pick at least one" value={hobbies} presets={PROFILE_CHIP_PRESETS.hobbies} onChange={setHobbies} />
          <ChipField label="Dislikes" value={dislikes} presets={PROFILE_CHIP_PRESETS.dislikes} onChange={setDislikes} />
          <ChipField
            label="Dealbreakers"
            value={dealbreakers}
            presets={PROFILE_CHIP_PRESETS.dislikes}
            onChange={setDealbreakers}
            placeholder="Add a dealbreaker"
          />
        </>
      ) : null}

      {step === "prefs" ? (
        <>
          <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>Dating prefs</h1>
          <label style={{ display: "grid", gap: 6 }}>
            Your name
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Age
            <input value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" />
          </label>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <legend style={{ fontWeight: 600 }}>Gender</legend>
            <div className="ss-chip-row">
              {GENDER_OPTIONS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="ss-chip"
                  aria-pressed={gender === g.id}
                  onClick={() => setGender(g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <legend style={{ fontWeight: 600 }}>Looking for gender</legend>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              Age range min
              <input value={ageRangeMin} onChange={(e) => setAgeRangeMin(e.target.value)} inputMode="numeric" />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              Age range max
              <input value={ageRangeMax} onChange={(e) => setAgeRangeMax(e.target.value)} inputMode="numeric" />
            </label>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <legend style={{ fontWeight: 600 }}>Max travel (miles)</legend>
            <div className="ss-chip-row">
              {TRAVEL_MILE_OPTIONS.map((miles) => (
                <button
                  key={miles}
                  type="button"
                  className="ss-chip"
                  aria-pressed={maxTravelMiles === miles}
                  onClick={() => setMaxTravelMiles(miles)}
                >
                  {miles} mi
                </button>
              ))}
            </div>
          </fieldset>
          <ChipField label="Cuisine" value={cuisine} presets={PROFILE_CHIP_PRESETS.cuisine} onChange={setCuisine} />
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <legend style={{ fontWeight: 600 }}>Budget</legend>
            <div className="ss-chip-row">
              {([1, 2, 3, 4] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  className="ss-chip"
                  aria-pressed={budget === tier}
                  onClick={() => setBudget(tier)}
                >
                  {"$".repeat(tier)}
                </button>
              ))}
            </div>
          </fieldset>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={botDatingOptIn}
              onChange={(e) => setBotDatingOptIn(e.target.checked)}
              style={{ width: 20, height: 20 }}
            />
            I want an AI bot to date on my behalf
          </label>
        </>
      ) : null}

      {step === "home" ? (
        <>
          <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>Home base</h1>
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
        </>
      ) : null}

      {step === "review" && saved ? (
        <>
          <div className="ss-card" style={{ display: "grid", gap: 8 }}>
            <p style={{ margin: 0, fontFamily: "var(--ss-font-display)", fontSize: 22 }}>{botDisplayName || "Your bot"}</p>
            {vibeLine ? <p style={{ margin: 0, color: "var(--ss-text-muted)" }}>{vibeLine}</p> : null}
            <p style={{ margin: 0, color: "var(--ss-text-muted)" }}>
              {displayName || "You"} · {gender} · interested in {lookingForGender} · {intent}
            </p>
            <p style={{ margin: 0, color: "var(--ss-text-muted)" }}>
              {city} / {neighborhood} · {maxTravelMiles} miles
            </p>
          </div>
          <PublishActions botName={botDisplayName} />
        </>
      ) : null}

      {step === "review" && !saved ? (
        <>
          <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>Review & publish</h1>
          <div className="ss-card" style={{ display: "grid", gap: 8 }}>
            <p style={{ margin: 0, fontFamily: "var(--ss-font-display)", fontSize: 22 }}>{botDisplayName || "Your bot"}</p>
            {vibeLine ? <p style={{ margin: 0, color: "var(--ss-text-muted)" }}>{vibeLine}</p> : null}
            <p style={{ margin: 0, color: "var(--ss-text-muted)" }}>
              {displayName || "You"} · {gender} · interested in {lookingForGender} · {intent}
            </p>
            <p style={{ margin: 0, color: "var(--ss-text-muted)" }}>
              {city} / {neighborhood} · {maxTravelMiles} miles
            </p>
          </div>
        </>
      ) : null}

      {error ? <SoftError>{error}</SoftError> : null}

      {step !== "review" || !saved ? (
        <div style={{ display: "flex", gap: 8 }}>
          {stepIndex > 0 ? (
            <button type="button" className="ss-btn ss-btn-ghost" onClick={() => setStep(STEPS[stepIndex - 1]!)}>
              Back
            </button>
          ) : null}
          {step === "home" || (step === "review" && !saved) ? (
            <button type="button" className="ss-btn ss-btn-primary" disabled={busy} onClick={() => void saveAndReview()}>
              {busy ? "Saving…" : "Continue"}
            </button>
          ) : (
            <button type="button" className="ss-btn ss-btn-primary" onClick={() => nextFrom(step)}>
              Continue
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
