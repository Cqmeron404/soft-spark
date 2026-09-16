import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  name: string;
  value?: string;
  onChange: (uri: string | undefined) => void;
};

export function PhotoStep(props: Props) {
  const [nudge, setNudge] = useState(false);
  const initials = (props.name.trim()[0] ?? "?").toUpperCase();

  async function pick() {
    try {
      const ImagePicker = await import("expo-image-picker");
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        props.onChange(result.assets[0].uri);
        setNudge(false);
      }
    } catch {
      setNudge(true);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.frame}>
        {props.value ? (
          <Image source={{ uri: props.value }} style={styles.img} />
        ) : (
          <View style={styles.initials}>
            <Text style={styles.letter}>{initials}</Text>
          </View>
        )}
      </View>
      <Text style={styles.title}>Add a photo so your invite feels human</Text>
      <Text style={styles.helper}>Soft circle crop · cream frame · coral blush ring</Text>
      <Pressable onPress={() => void pick()} style={styles.primary}>
        <Text style={styles.primaryText}>Choose photo</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          props.onChange(undefined);
          setNudge(true);
        }}
      >
        <Text style={styles.link}>Use initials for now</Text>
      </Pressable>
      {nudge && !props.value ? <Text style={styles.helper}>A photo makes the invite warmer</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 10 },
  frame: {
    width: 120,
    height: 120,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: "#E8A598",
    backgroundColor: "#FFF8F2",
    overflow: "hidden",
  },
  img: { width: "100%", height: "100%" },
  initials: {
    flex: 1,
    backgroundColor: "#E8A598",
    alignItems: "center",
    justifyContent: "center",
  },
  letter: { fontSize: 42, fontWeight: "600", color: "#2A211C" },
  title: { fontWeight: "600", color: "#2A211C", textAlign: "center" },
  helper: { color: "#7A6E66", textAlign: "center", fontSize: 13 },
  primary: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "#E8A598",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "600", color: "#2A211C" },
  link: { color: "#2A211C", fontWeight: "600", textDecorationLine: "underline" },
});
