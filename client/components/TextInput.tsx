import React from "react";
import { 
  View, 
  TextInput as RNTextInput, 
  StyleSheet, 
  TextInputProps as RNTextInputProps,
  ViewStyle 
} from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function TextInput({
  label,
  error,
  containerStyle,
  style,
  ...props
}: TextInputProps) {
  const { theme } = useTheme();

  return (
    <View style={containerStyle}>
      {label ? (
        <ThemedText type="small" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
      <RNTextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.inputBackground,
            borderColor: error ? theme.error : theme.border,
            color: theme.text,
          },
          style,
        ]}
        placeholderTextColor={theme.textSecondary}
        {...props}
      />
      {error ? (
        <ThemedText type="small" style={[styles.error, { color: theme.error }]}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: Spacing.xs,
    fontWeight: "500",
  },
  input: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
  },
  error: {
    marginTop: Spacing.xs,
  },
});
