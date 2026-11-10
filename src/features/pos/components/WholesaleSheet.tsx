import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { PosProduct } from '../../../services/pos/types';
import { getSortedWholesaleTiers } from '../lib';
import { colors, formatMMK, formatNumber } from '../theme';
import BottomSheet from './BottomSheet';

interface Props {
  product: PosProduct | null;
  onClose: () => void;
  onSelectTier: (product: PosProduct, tierQuantity: number) => void;
}

export default function WholesaleSheet({ product, onClose, onSelectTier }: Props) {
  const tiers = product ? getSortedWholesaleTiers(product) : [];

  return (
    <BottomSheet visible={!!product} title="Wholesale prices" onClose={onClose} maxHeight="60%">
      <ScrollView contentContainerStyle={styles.content}>
        {product && (
          <Text style={styles.product} numberOfLines={2}>
            {product.productName} · {formatMMK(product.sellingPrice)}
          </Text>
        )}
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>Quantity</Text>
          <Text style={styles.headerText}>Price</Text>
        </View>
        {tiers.map((tier) => (
          <TouchableOpacity
            key={`${tier.quantity}-${tier.price}`}
            style={styles.tierRow}
            onPress={() => product && onSelectTier(product, tier.quantity)}
            activeOpacity={0.7}
          >
            <Text style={styles.tierQty}>{tier.quantity}+</Text>
            <Text style={styles.tierPrice}>{formatNumber(tier.price)} MMK</Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.hint}>အရေအတွက်ကို နှိပ်ရင် ခြင်းတောင်းထဲ အဲ့ဒီအရေအတွက်နဲ့ ထည့်ပေးပါမယ်</Text>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  product: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  tierQty: {
    fontSize: 15,
    color: colors.text,
  },
  tierPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.textFaint,
    marginTop: 12,
  },
});
