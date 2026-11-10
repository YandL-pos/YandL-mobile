import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../../theme';

interface Props {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}

// Radio-style choice, as on the web checkout
export default function OptionCard({ label, active, disabled = false, onPress }: Props) {
  const isActive = active && !disabled;
  return (
    <TouchableOpacity
      style={[styles.card, isActive && styles.cardActive, disabled && styles.cardDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={[styles.radio, isActive && styles.radioActive]}>
        {isActive && <View style={styles.radioDot} />}
      </View>
      <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  cardDisabled: {
    opacity: 0.5,
    backgroundColor: colors.borderSoft,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  label: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
