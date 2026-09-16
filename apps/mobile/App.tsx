import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

const ROUTES = ["/onboard", "/matches", "/matches/:id/reveal", "/matches/:id/invite"];

export default function App() {
  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <Text style={styles.brand}>Soft spark</Text>
      <Text style={styles.sub}>Mobile shell — same Slice 1 routes as web.</Text>
      {ROUTES.map((route) => (
        <View key={route} style={styles.card}>
          <Text style={styles.route}>{route}</Text>
          <Text style={styles.copy}>
            {route === "/onboard"
              ? "Let’s build your dating bot"
              : route === "/matches"
                ? "Your bots are out"
                : route.includes("reveal")
                  ? "It’s a match · Maybe later dismisses reveal only"
                  : "Invite card · I’m in / Pass"}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F1EA",
    paddingTop: 72,
    paddingHorizontal: 20,
    gap: 12,
  },
  brand: {
    fontSize: 32,
    fontWeight: "600",
    color: "#2A211C",
    fontFamily: "Georgia",
  },
  sub: { color: "#7A6E66", marginBottom: 8 },
  card: {
    backgroundColor: "#FFF8F2",
    borderColor: "#E8DFD6",
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
  },
  route: { fontWeight: "600", color: "#2A211C" },
  copy: { color: "#7A6E66", marginTop: 4 },
});
