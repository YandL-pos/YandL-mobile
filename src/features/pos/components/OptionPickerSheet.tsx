import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { colors } from '../theme';
import BottomSheet from './BottomSheet';

interface Props<T extends string> {
  visible: boolean;
  title: string;
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}

// List picker behind the filter dropdowns (the native stand-in for the web's <select>)
export default function OptionPickerSheet<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: Props<T>) {
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose} maxHeight="75%">
      <ScrollView contentContainerStyle={styles.list}>
        {options.map((option) => {
          const active = option.value === selected;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => {
                onSelect(option.value);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
              {active && <Text style={styles.check}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  optionActive: {
    backgroundColor: colors.primarySoft,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  optionTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  check: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
});
