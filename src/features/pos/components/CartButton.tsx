import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, formatNumber } from '../theme';

interface Props {
  itemCount: number;
  subtotal: number;
  onPress: () => void;
}

// Floating pill at the bottom right, shown only while the cart has items; tapping opens the cart
export default function CartButton({ itemCount, subtotal, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.icon}>🛒</Text>
      <Text style={styles.count}>{itemCount}</Text>
      <View style={styles.divider} />
      <Text style={styles.total}>
        {formatNumber(subtotal)}
        <Text style={styles.currency}> MMK</Text>
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    fontSize: 18,
  },
  count: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  total: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  currency: {
    fontSize: 12,
    fontWeight: '600',
  },
});
