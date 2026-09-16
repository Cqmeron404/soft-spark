import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { formatMilesFromKm } from "@soft-spark/shared";
import { DualStatusRow, InviteActions } from "./src/DualStatusRow";
import { PhotoStep } from "./src/PhotoStep";
import {
  acceptInvite,
  api,
  declineInvite,
  getToken,
  registerPush,
  setToken,
  signIn,
  signUp,
  type MatchLike,
} from "./src/api";

type Screen =
  | "signin"
  | "signup"
  | "onboard"
  | "matches"
  | "reveal"
  | "invite";

type MatchItem = MatchLike;

const CREAM = "#F7F1EA";
const SURFACE = "#FFF8F2";
const TEXT = "#2A211C";
const MUTED = "#7A6E66";
const ACCENT = "#E8A598";
const BORDER = "#E8DFD6";

export default function App() {
  const [screen, setScreen] = useState<Screen>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [photoSkipped, setPhotoSkipped] = useState(false);
  const [doneOnboard, setDoneOnboard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [active, setActive] = useState<MatchItem | null>(null);

  async function loadMatches() {
    const items = await api<MatchItem[]>("/matches");
    setMatches(items);
  }

  async function goAfterAuth() {
    try {
      await api("/users/me");
      setScreen("matches");
      await loadMatches();
      void registerExpoPush();
    } catch (err) {
      if ((err as { status?: number }).status === 404) setScreen("onboard");
      else setError(err instanceof Error ? err.message : "Auth failed");
    }
  }

  async function registerExpoPush() {
    try {
      const Notifications = await import("expo-notifications");
      const Device = await import("expo-device");
      if (!Device.isDevice) return;
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;
      const tokenRes = await Notifications.getExpoPushTokenAsync();
      await registerPush(tokenRes.data);
    } catch {
      /* push optional until Expo secrets / device */
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <StatusBar style="dark" />
      <View style={styles.brandRow}>
        <Image
          source={require("./assets/brand/png/soft-spark-mark-128.png")}
          style={styles.mark}
          accessibilityLabel="Soft Spark"
        />
        <Text style={styles.brand}>Soft Spark</Text>
      </View>

      {screen === "signin" ? (
        <View style={styles.stack}>
          <Text style={styles.h1}>Welcome back</Text>
          <Text style={styles.muted}>Your bot dates. You show up.</Text>
          <Field label="Email" value={email} onChange={setEmail} />
          <Field label="Password" value={password} onChange={setPassword} secure />
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <Btn
            label="Sign in"
            onPress={async () => {
              setError(null);
              try {
                await signIn({ email, password });
                await goAfterAuth();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Sign in failed");
              }
            }}
          />
          <Pressable onPress={() => setScreen("signup")}>
            <Text style={styles.link}>Create account</Text>
          </Pressable>
        </View>
      ) : null}

      {screen === "signup" ? (
        <View style={styles.stack}>
          <Text style={styles.h1}>Join Soft Spark</Text>
          <Text style={styles.muted}>Your bot dates. You show up.</Text>
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Email" value={email} onChange={setEmail} />
          <Field label="Password" value={password} onChange={setPassword} secure />
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <Btn
            label="Continue"
            onPress={async () => {
              setError(null);
              try {
                await signUp({ email, password, name });
                setScreen("onboard");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Sign up failed");
              }
            }}
          />
          <Pressable onPress={() => setScreen("signin")}>
            <Text style={styles.link}>Sign in</Text>
          </Pressable>
        </View>
      ) : null}

      {screen === "onboard" ? (
        <View style={styles.stack}>
          {doneOnboard ? (
            <Text style={styles.h1}>Your bot’s ready. We’ll ping you when chemistry builds</Text>
          ) : (
            <>
          <Text style={styles.h1}>Let’s build your dating bot</Text>
          <PhotoStep
            name={name}
            value={photoUrl}
            onChange={(uri) => {
              setPhotoUrl(uri);
              setPhotoSkipped(!uri);
            }}
          />
          <Field label="Name" value={name} onChange={setName} />
          <Pressable onPress={() => setOptIn(!optIn)}>
            <Text style={styles.body}>{optIn ? "☑" : "☐"} I want an AI bot to date on my behalf</Text>
          </Pressable>
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <Btn
            label="Continue"
            onPress={async () => {
              setError(null);
              try {
                await api("/users/me/onboard", {
                  method: "POST",
                  body: JSON.stringify({
                    botDatingOptIn: optIn,
                    profile: { displayName: name || "You", age: 29, gender: "woman", interestedIn: ["man"] },
                    prefs: {
                      cuisine: ["italian", "american"],
                      budget: 3,
                      maxTravelKm: 25,
                      dealbreakers: [],
                      lookingFor: "relationship",
                      interests: ["food", "hiking"],
                    },
                    homeGeo: { lat: 39.739, lng: -104.979 },
                    homeTz: "America/Denver",
                    vibeTags: ["Curious"],
                    photoUrl,
                    photoSkipped,
                  }),
                });
                setDoneOnboard(true);
                void registerExpoPush();
                setTimeout(() => {
                  setScreen("matches");
                  void loadMatches();
                }, 1200);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Onboard failed");
              }
            }}
          />
            </>
          )}
        </View>
      ) : null}

      {screen === "matches" ? (
        <View style={styles.stack}>
          <Text style={styles.h1}>Your bots are out</Text>
          <Text style={styles.muted}>{getToken() ? "Live session" : "Catching up…"}</Text>
          <Btn
            label="Run match job (demo)"
            onPress={async () => {
              try {
                await api("/internal/orchestrate", { method: "POST", body: "{}" });
                await loadMatches();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Job failed");
              }
            }}
          />
          {matches.length === 0 ? <Text style={styles.muted}>No active matches yet — your bot’s exploring</Text> : null}
          {matches.map((m) => (
            <Pressable
              key={m.id}
              style={styles.card}
              onPress={() => {
                if (m.state === "invite_ready" || m.state === "invited" || m.state === "booked") {
                  setActive(m);
                  setScreen("reveal");
                }
              }}
            >
              <Text style={styles.cardTitle}>{m.peer?.displayName ?? "Someone"}</Text>
              <Text style={styles.muted}>{m.band}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => {
              setToken(null);
              setScreen("signin");
            }}
          >
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        </View>
      ) : null}

      {screen === "reveal" && active ? (
        <View style={styles.stack}>
          <Text style={styles.h1}>It’s a match</Text>
          <Text style={styles.body}>{active.peer?.displayName ?? "Someone"} · Your bots found real chemistry</Text>
          <Btn
            label="See the invite"
            onPress={async () => {
              const detail = await api<MatchItem>(`/matches/${active.id}`);
              setActive(detail);
              setScreen("invite");
            }}
          />
          <Pressable onPress={() => setScreen("matches")}>
            <Text style={styles.link}>Maybe later</Text>
          </Pressable>
        </View>
      ) : null}

      {screen === "invite" && active?.invite ? (
        <InviteScreen active={active} setActive={setActive} />
      ) : null}
    </ScrollView>
  );
}

function InviteScreen(props: {
  active: MatchItem;
  setActive: (m: MatchItem) => void;
}) {
  const { active, setActive } = props;
  const invite = active.invite!;
  const expired = Boolean(invite.window.end && Date.parse(invite.window.end) < Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      void api<MatchItem>(`/matches/${active.id}`).then(setActive);
    }, 2500);
    return () => clearInterval(t);
  }, [active.id, setActive]);

  return (
    <View style={styles.stack}>
      <Text style={styles.h1}>{invite.venue.name}</Text>
      <Text style={styles.muted}>
        {formatMilesFromKm(invite.venue.travelKmYou)} mi from you · {formatMilesFromKm(invite.venue.travelKmThem)} mi from
        them
      </Text>
      <DualStatusRow
        themName={active.peer?.displayName ?? "Them"}
        you={invite.you}
        them={invite.them}
        expired={expired}
      />
      <InviteActions
        you={invite.you}
        them={invite.them}
        expired={expired}
        onAccept={async () => setActive(await acceptInvite(active.id, invite.id))}
        onPass={async () => setActive(await declineInvite(active.id, invite.id))}
      />
    </View>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; secure?: boolean }) {
  return (
    <View>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        secureTextEntry={props.secure}
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.btn}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: CREAM,
    paddingTop: 72,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  mark: { width: 24, height: 24, borderRadius: 6 },
  brand: { fontSize: 22, fontWeight: "600", color: TEXT, fontFamily: "Georgia" },
  stack: { gap: 12 },
  h1: { fontSize: 28, fontWeight: "600", color: TEXT, fontFamily: "Georgia" },
  body: { color: TEXT, fontSize: 16 },
  muted: { color: MUTED },
  err: { color: TEXT, backgroundColor: "#F0C4A8", padding: 12, borderRadius: 14, overflow: "hidden" },
  link: { color: TEXT, fontWeight: "600", textDecorationLine: "underline" },
  label: { color: MUTED, marginBottom: 6 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: SURFACE,
    color: TEXT,
  },
  btn: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontWeight: "600", color: TEXT, fontSize: 16 },
  card: {
    backgroundColor: SURFACE,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  cardTitle: { fontWeight: "600", color: TEXT, fontSize: 16 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "#E8A598",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    borderWidth: 4,
    borderColor: "#FFF8F2",
  },
  avatarText: { fontSize: 42, fontWeight: "600", color: TEXT },
});
