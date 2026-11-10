import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

import { getTodayDateString } from '../lib';
import { colors } from '../theme';

interface Props {
  // YYYY-MM-DD
  value: string;
  onChange: (value: string) => void;
}

const toDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default function OrderDateField({ value, onChange }: Props) {
  const date = toDate(value);
  const handlePicked = (_event: unknown, picked: Date) => onChange(getTodayDateString(picked));

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.iosRow}>
        <DateTimePicker value={date} mode="date" display="compact" onValueChange={handlePicked} />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.field}
      onPress={() => DateTimePickerAndroid.open({ value: date, mode: 'date', onValueChange: handlePicked })}
      activeOpacity={0.8}
    >
      <Text style={styles.icon}>📅</Text>
      <Text style={styles.value}>{value}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  icon: {
    fontSize: 16,
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  iosRow: {
    alignItems: 'flex-start',
  },
});
