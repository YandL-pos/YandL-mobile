import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { PosProduct } from '../../../services/pos/types';
import { getShelfStock, getUnitPrice, LOW_STOCK_THRESHOLD } from '../lib';
import { colors, formatMMK } from '../theme';

interface Props {
  product: PosProduct;
  cartQty: number;
  // Columns in the grid; keeps a lone card on the last row from stretching across the others
  columns: number;
  onPress: (product: PosProduct) => void;
  onWholesalePress: (product: PosProduct) => void;
}

function ProductCard({ product, cartQty, columns, onPress, onWholesalePress }: Props) {
  const stock = getShelfStock(product);
  const outOfStock = stock <= 0;
  const inCart = cartQty > 0;
  const hasWholesale = (product.wholesalePrices?.length ?? 0) > 0;

  const stockStyle = outOfStock ? styles.stockOut : stock <= LOW_STOCK_THRESHOLD ? styles.stockLow : styles.stockOk;
  const stockTextStyle = outOfStock
    ? styles.stockOutText
    : stock <= LOW_STOCK_THRESHOLD
      ? styles.stockLowText
      : styles.stockOkText;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { maxWidth: `${100 / columns}%` },
        inCart && styles.cardInCart,
        outOfStock && styles.cardDisabled,
      ]}
      onPress={() => onPress(product)}
      disabled={outOfStock}
      activeOpacity={0.75}
    >
      {inCart && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{cartQty}</Text>
        </View>
      )}

      <Text style={styles.name} numberOfLines={2}>
        {product.productName}
      </Text>
      {!!product.productCode && <Text style={styles.code}>{product.productCode}</Text>}
      {!!product.category && (
        <Text style={styles.category} numberOfLines={1}>
          {product.category}
        </Text>
      )}
      <View style={[styles.stockPill, stockStyle]}>
        <Text style={[styles.stockText, stockTextStyle]}>{outOfStock ? 'Out of stock' : `Qty: ${stock}`}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.price}>{formatMMK(getUnitPrice(product))}</Text>
        {hasWholesale && (
          <TouchableOpacity
            onPress={() => onWholesalePress(product)}
            style={styles.wholesale}
            hitSlop={6}
            disabled={outOfStock}
          >
            <Text style={styles.wholesaleText}>Wholesale</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default memo(ProductCard);

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
    minHeight: 150,
  },
  cardInCart: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  cardDisabled: {
    opacity: 0.45,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    paddingRight: 26,
  },
  code: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  category: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  stockPill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  stockOk: { backgroundColor: colors.successSoft },
  stockLow: { backgroundColor: colors.warningSoft },
  stockOut: { backgroundColor: colors.dangerSoft },
  stockText: {
    fontSize: 10,
    fontWeight: '700',
  },
  stockOkText: { color: colors.success },
  stockLowText: { color: colors.warning },
  stockOutText: { color: colors.danger },
  footer: {
    marginTop: 'auto',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
  },
  price: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  wholesale: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fcd34d',
    backgroundColor: colors.warningSoft,
  },
  wholesaleText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
  },
});
