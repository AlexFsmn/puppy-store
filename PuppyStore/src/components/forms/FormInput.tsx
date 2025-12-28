import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import {colors, spacing, layout, fontSize, fontWeight} from '../../theme';

type FormInputProps = TextInputProps & {
  label?: string;
  multiline?: boolean;
};

export function FormInput({
  label,
  multiline = false,
  style,
  ...props
}: FormInputProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          multiline && styles.textArea,
          style,
        ]}
        placeholderTextColor={colors.textMuted}
        textAlignVertical={multiline ? 'top' : 'center'}
        multiline={multiline}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm - 2, // 6px
  },
  label: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.inputRadius,
    padding: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  textArea: {
    minHeight: 80,
  },
});
