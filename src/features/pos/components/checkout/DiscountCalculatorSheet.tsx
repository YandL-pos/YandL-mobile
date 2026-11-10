import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { discountPercentFromAmount } from '../../lib';
import { colors, formatMMK } from '../../theme';
import BottomSheet from '../BottomSheet';

interface Props {
  visible: boolean;
  subtotal: number;
  onApply: (percent: number) => void;
  onClose: () => void;
}

// Type the discount in MMK; the order stores it as a percentage of the subtotal
export default function DiscountCalculatorSheet({ visible, subtotal, onApply, onClose }: Props) {
  const [amountText, setAmountText] = useState('');
  const amount = Number(amountText);
  const percent = discountPercentFromAmount(amount, subtotal);

  const close = () => {
    setAmountText('');
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      title="Discount Calculator"
      onClose={close}
      maxHeight="70%"
      footer={
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancel} onPress={close}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.apply, percent === null && styles.applyDisabled]}
            disabled={percent === null}
            onPress={() => {
              if (percent === null) return;
              onApply(percent);
              close();
            }}
          >
            <Text style={styles.applyText}>Apply Discount</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View style={styles.body}>
        <View style={styles.subtotalBox}>
          <Text style={styles.muted}>Current Subtotal</Text>
          <Text style={styles.subtotal}>{formatMMK(subtotal)}</Text>
        </View>

        <Text style={styles.label}>Discount Amount (MMK)</Text>
        <TextInput
          style={styles.input}
          value={amountText}
          onChangeText={(text) => setAmountText(text.replace(/[^0-9.]/g, ''))}
          placeholder="Enter discount amount..."
          keyboardType="decimal-pad"
          autoFocus
        />

        {amount > 0 && (
          <View style={[styles.preview, percent === null && styles.previewInvalid]}>
            {percent === null ? (
              <Text style={styles.invalidText}>Subtotal ထက် မကျော်ရပါ</Text>
            ) : (
              <>
                <View style={styles.previewRow}>
                  <Text style={styles.muted}>Percentage:</Text>
                  <Text style={styles.previewValue}>{percent.toFixed(2)}%</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.muted}>Final Total:</Text>
                  <Text style={styles.previewTotal}>{formatMMK(subtotal - amount)}</Text>
                </View>
              </>
            )}
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: 20,
    gap: 10,
  },
  subtotalBox: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  muted: {
    fontSize: 13,
    color: colors.textMuted,
  },
  subtotal: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  preview: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: colors.successSoft,
    gap: 6,
  },
  previewInvalid: {
    borderColor: '#fecaca',
    backgroundColor: colors.dangerSoft,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewValue: {
    fontWeight: '700',
    color: colors.success,
  },
  previewTotal: {
    fontWeight: '700',
    color: colors.text,
  },
  invalidText: {
    color: colors.danger,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  cancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.text,
    fontWeight: '600',
  },
  apply: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  applyDisabled: {
    opacity: 0.5,
  },
  applyText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
