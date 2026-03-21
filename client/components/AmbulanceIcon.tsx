import React from "react";
import { Image, StyleSheet } from "react-native";

interface AmbulanceIconProps {
  size?: number;
  color?: string;
}

export function AmbulanceIcon({ size = 24, color }: AmbulanceIconProps) {
  return (
    <Image
      source={require("@/assets/images/ambulance-icon.png")}
      style={[
        styles.icon,
        {
          width: size,
          height: size,
        },
        color ? { tintColor: color } : null,
      ]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    opacity: 1,
  },
});
