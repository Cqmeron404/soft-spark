"use client";

import { useState } from "react";
import type { LookingForGender, OnboardBody, ProfileGender } from "@soft-spark/shared";
import {
  GENDER_OPTIONS,
  INTENT_OPTIONS,
  LOOKING_FOR_GENDER_OPTIONS,
  PROFILE_CHIP_PRESETS,
  TRAVEL_MILE_OPTIONS,
} from "@soft-spark/shared";
import { PhotoCrop, SoftError } from "@soft-spark/ui";
import { ChipField } from "@/components/ChipField";
import { QuietDemoLinks } from "@/components/DemoSignInButtons";
import { PublishActions } from "@/components/PublishActions";
import { onboard } from "@/lib/api";
import { CITY_NEIGHBORHOODS, DEFAULT_CITY, DEFAULT_VIBES, geoForPlace } from "@/lib/guest";
import { writeSession } from "@/lib/session";

type Step = "bot" | "look" | "taste" | "prefs" | "home" | "review";
const STEPS: Step[] = ["bot", "look", "taste", "prefs", "home", "review"];

export function OnboardWizard(props: { defaultName?: string }) {
  const [step, setStep] = useState<Step>("bot");
  const [botName, setBotName] = useState("");
  const [styleTags, setStyleTags] = useState<string[]>(["Curious"]);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [height, setHeight] = useState("");
  const [hairColor, setHairColor] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [likes, setLikes] = useState<string[]>([]);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [dealbreakers, setDealbreakers] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [displayName, setDisplayName] = useState(props.defaultName ?? "");
  const [age, setAge] = useState("29");
  const [gender, setGender] = useState<ProfileGender>("female");
  const [lookingForGender, setLookingForGender] = useState<LookingForGender>("male");
  const [intent, setIntent] = useState("relationship");
  const [cuisine, setCuisine] = useState<string[]>(["italian"]);
  const [budget, setBudget] = useState<1 | 2 | 3 | 4>(3);
  const [botDatingOptIn, setBotDatingOptIn] = useState(true);
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
    if (current === "bot" && !botName.trim()) {
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
      if (!botDatingOptIn) {
        setError("Turn on bot dating to publish");
        return;
      }
    }
    setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)]!);
  }

  async function saveAndReview() {
    setError(null);
    if (!botName.trim()) {
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
      setError("Turn on bot dating to publish");
      setStep("prefs");
      return;
    }
    setBusy(true);
    try {
      const place = geoForPlace(city, neighborhood);
      const body: OnboardBody = {
        botDatingOptIn: true,
        botName: botName.trim(),
        styleTags,
        vibeTags: styleTags,
        photoUrl,
        profile: {
          displayName: displayName.trim() || "You",
          age: Number(age) || 29,
          gender,
          lookingForGender,
          interestedIn: lookingForGender === "both" ? ["male", "female"] : [lookingForGender],
          bio: bio.trim() || undefined,
          height: height.trim() || undefined,
          hairColor: hairColor.trim() || undefined,
          eyeColor: eyeColor.trim() || undefined,
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
          lookingFor: intent,
          lookingForGender,
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
            Name your dating bot
          </h1>
          <p style={{ margin: 0, color: "var(--ss-text-muted)", lineHeight: 1.45 }}>
            They’ll explore chemistry for you. You only show up when there’s a real invite.
          </p>
          <ol className="ss-how-it-works">
            <li>Create bot</li>
            <li>Bots roam</li>
            <li>You show up</li>
          </ol>
          <label style={{ display: "grid", gap: 6 }}>
            Bot name
            <input value={botName} onChange={(e) => setBotName(e.target.value)} placeholder="Ember" autoComplete="off" />
          </label>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <legend style={{ fontWeight: 600 }}>Vibe</legend>
            <div className="ss-chip-row">
              {DEFAULT_VIBES.map((v) => (
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

      {step === "look" ? (
        <>
          <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>Look</h1>
          <PhotoCrop name={displayName || botName} value={photoUrl} onChange={setPhotoUrl} />
          <label style={{ display: "grid", gap: 6 }}>
            Height
            <input value={height} onChange={(e) => setHeight(e.target.value)} placeholder={`5'7" or 170 cm`} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Hair color
            <input value={hairColor} onChange={(e) => setHairColor(e.target.value)} placeholder="dark brown" list="ss-hair" />
            <datalist id="ss-hair">
              {PROFILE_CHIP_PRESETS.hairColor.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            Eye color
            <input value={eyeColor} onChange={(e) => setEyeColor(e.target.value)} placeholder="brown" list="ss-eyes" />
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
          <label style={{ display: "grid", gap: 6 }}>
            Bio
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} style={{ minHeight: 88, padding: 12 }} />
          </label>
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
            Let my bot date for me
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
        </>
      ) : null}

      {step === "review" && saved ? <PublishActions botName={botName} /> : null}

      {step === "review" && !saved ? (
        <>
          <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 30, margin: 0 }}>Review & publish</h1>
          <div className="ss-card" style={{ display: "grid", gap: 8 }}>
            <p style={{ margin: 0, fontFamily: "var(--ss-font-display)", fontSize: 22 }}>{botName || "Your bot"}</p>
            <p style={{ margin: 0, color: "var(--ss-text-muted)" }}>
              {displayName || "You"} · {gender} looking for {lookingForGender} · {intent}
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

      {step === "bot" ? <QuietDemoLinks /> : null}
    </div>
  );
}
