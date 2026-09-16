import { Pressable, StyleSheet, Text, View } from "react-native";
import { dualStatusSummary, type InviteUserStatus } from "@soft-spark/shared";

const TEXT = "#2A211C";
const MUTED = "#7A6E66";
const SURFACE = "#FFF8F2";
const BORDER = "#E8DFD6";
const SUCCESS = "#5C8A6E";
const DANGER = "#B85C4E";

export function DualStatusRow(props: {
  themName: string;
  you: InviteUserStatus;
  them: InviteUserStatus;
  expired?: boolean;
}) {
  return (
    <View style={styles.box}>
      <StatusLine who="You" status={props.you} />
      <StatusLine who={props.themName} status={props.them} />
      <Text style={styles.summary}>
        {dualStatusSummary({
          themName: props.themName,
          you: props.you,
          them: props.them,
          expired: props.expired,
        })}
      </Text>
    </View>
  );
}

function StatusLine({ who, status }: { who: string; status: InviteUserStatus }) {
  return (
    <View style={styles.row}>
      <Text style={styles.who}>{who}</Text>
      <Text style={styles.dot}>·</Text>
      <View
        style={[
          styles.pill,
          status === "accepted" && styles.accepted,
          status === "declined" && styles.declined,
          status === "waiting" && styles.waiting,
        ]}
      >
        <Text
          style={[
            styles.pillText,
            status === "declined" && { color: DANGER },
            status === "waiting" && { color: MUTED },
          ]}
        >
          {status}
        </Text>
      </View>
    </View>
  );
}

export function InviteActions(props: {
  you: InviteUserStatus;
  them: InviteUserStatus;
  expired?: boolean;
  onAccept: () => void;
  onPass: () => void;
}) {
  const closed = props.expired || props.you === "declined" || props.them === "declined";
  const booked = props.you === "accepted" && props.them === "accepted";
  if (closed || booked || props.you !== "waiting") return null;
  return (
    <View style={{ gap: 10 }}>
      <Pressable onPress={props.onAccept} style={styles.inBtn}>
        <Text style={styles.inText}>I’m in</Text>
      </Pressable>
      <Pressable onPress={props.onPass}>
        <Text style={styles.pass}>Pass</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  who: { color: TEXT, fontSize: 14 },
  dot: { color: MUTED },
  summary: { color: MUTED, fontSize: 14 },
  pill: {
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
    justifyContent: "center",
  },
  waiting: { borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE },
  accepted: { backgroundColor: "rgba(92,138,110,0.28)" },
  declined: { borderWidth: 1, borderColor: DANGER, backgroundColor: "transparent" },
  pillText: { color: TEXT, textTransform: "capitalize", fontSize: 13, fontWeight: "600" },
  inBtn: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#E8A598",
    alignItems: "center",
    justifyContent: "center",
  },
  inText: { fontWeight: "600", color: TEXT, fontSize: 16 },
  pass: { color: DANGER, fontWeight: "600", textAlign: "center", textDecorationLine: "underline" },
});
