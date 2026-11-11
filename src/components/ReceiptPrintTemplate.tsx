import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TextProps, View } from 'react-native';

import { RECEIPT_FONT } from '../fonts';
import { ReceiptData } from '../services/receiptCaptureService';
import { useShopStore } from '../store/shopStore';

// Section order and proportions follow the web app's thermal voucher (VoucherContent.tsx); labels are Burmese.
// All text is medium (500), in pure black, since thermal printers print grey faintly.
// Sizes are in receipt pixels: the picture is 384 (58mm) or 576 (80mm) wide.

const MAX_PRINTED_ITEMS = 200;

interface Props {
  receipt: ReceiptData;
  paperWidth: 58 | 80;
  // The logo finished loading or failed, so the picture can be taken
  onLogoSettled?: () => void;
}

const amount = (value?: number) => Number(value ?? 0).toLocaleString('en-US');

// Description / Price / Qty / Total widths, as on the web's 72mm and 58mm layouts
const COLUMNS = {
  80: [45, 18, 12, 25],
  58: [42, 20, 14, 24],
} as const;

// Every line uses the Walone font
function T({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.font, style]} />;
}

export default function ReceiptPrintTemplate({ receipt, paperWidth, onLogoSettled }: Props) {
  const defaultShop = useShopStore((state) => state.shop);
  const [logoFailed, setLogoFailed] = useState(false);
  const is80mm = paperWidth === 80;
  const [nameCol, priceCol, qtyCol, totalCol] = COLUMNS[paperWidth];

  // Text sizes as multiples of the body size, in the web's ratios (body 12px, total 22px, number 26px)
  const size = useMemo(() => {
    const base = is80mm ? 20 : 16.5;
    const at = (multiple: number) => ({
      fontSize: Math.round(base * multiple),
      lineHeight: Math.round(base * multiple * 1.5),
    });
    return {
      body: at(1),
      small: at(0.85),
      shopName: at(1.4),
      totalLabel: at(1.65),
      totalAmount: at(1.8),
      sequence: at(2.2),
      logo: Math.round(base * 4),
    };
  }, [is80mm]);

  const shopName = receipt.shopName || defaultShop.name;
  const shopAddress = receipt.shopAddress || defaultShop.address;
  const shopPhone = receipt.shopPhone || defaultShop.phone;
  const items = receipt.items || [];
  const showLogo = !!receipt.logoUrl && !logoFailed;

  const settleLogo = (failed: boolean) => {
    if (failed) setLogoFailed(true);
    onLogoSettled?.();
  };

  // Right-aligned label and amount, like the web's summary rows
  const summaryRow = (label: string, value: string, strong = false) => (
    <View style={styles.summaryRow}>
      <T style={[styles.summaryLabel, size.body, strong && styles.strong]}>{label}</T>
      <T style={[styles.summaryValue, size.body, strong && styles.strong]}>{value}</T>
    </View>
  );

  const hasCustomer = !!(receipt.customerName || receipt.customerPhone);
  const discountLabel =
    receipt.discountPercent && receipt.discountPercent > 0
      ? `လျှော့ဈေး (${Number(receipt.discountPercent.toFixed(2))}%)`
      : 'လျှော့ဈေး';

  return (
    <View style={[styles.container, { width: is80mm ? 576 : 384, paddingBottom: is80mm ? 150 : 130 }]}>
      {/* 1. Logo (or the shop's initial) and shop details */}
      <View style={styles.header}>
        {showLogo ? (
          <Image
            source={{ uri: receipt.logoUrl }}
            style={{ width: size.logo, height: size.logo }}
            resizeMode="contain"
            onLoad={() => settleLogo(false)}
            onError={() => settleLogo(true)}
          />
        ) : (
          <View style={[styles.logoFallback, { width: size.logo, height: size.logo }]}>
            <T style={[styles.logoLetter, size.shopName]}>{shopName.charAt(0)}</T>
          </View>
        )}
        <T style={[styles.shopName, size.shopName]}>{shopName}</T>
        {!!shopAddress && <T style={[styles.centerText, size.small]}>{shopAddress}</T>}
        {!!shopPhone && <T style={[styles.centerText, size.small]}>ဖုန်း: {shopPhone}</T>}
      </View>

      <View style={styles.dashedLine} />

      {/* 2. Customer */}
      {hasCustomer && (
        <View style={styles.customer}>
          {!!receipt.customerName && <T style={size.body}>ဝယ်သူ: {receipt.customerName}</T>}
          {!!receipt.customerPhone && <T style={size.body}>ဖုန်း: {receipt.customerPhone}</T>}
          {!!receipt.customerAddress && <T style={size.body}>လိပ်စာ: {receipt.customerAddress}</T>}
        </View>
      )}

      {/* 3. Column headers */}
      <View style={styles.row}>
        <T style={[styles.th, size.body, { flex: nameCol }]}>Item</T>
        <T style={[styles.th, styles.right, size.body, { flex: priceCol }]}>Price</T>
        <T style={[styles.th, styles.center, size.body, { flex: qtyCol }]}>Qty</T>
        <T style={[styles.th, styles.right, size.body, { flex: totalCol }]}>Total</T>
      </View>

      {/* 4. Items (capped so the picture stays within Android's maximum bitmap height) */}
      <View style={styles.items}>
        {items.slice(0, MAX_PRINTED_ITEMS).map((item, idx) => (
          <View key={idx} style={styles.row}>
            <View style={[styles.nameCell, { flex: nameCol }]}>
              <T style={[styles.td, size.body]}>{item.name}</T>
              {!!item.code && <T style={[styles.code, size.small]}>{item.code}</T>}
            </View>
            <T style={[styles.td, styles.right, size.body, { flex: priceCol }]}>{amount(item.price)}</T>
            <T style={[styles.td, styles.center, size.body, { flex: qtyCol }]}>{item.quantity ?? 0}</T>
            <T style={[styles.td, styles.right, size.body, { flex: totalCol }]}>
              {amount(item.subTotal)}
            </T>
          </View>
        ))}
        {items.length > MAX_PRINTED_ITEMS && (
          <T style={size.body}>... ကျန်ပစ္စည်း ({items.length - MAX_PRINTED_ITEMS} မျိုး)</T>
        )}
      </View>

      <View style={styles.dashedLine} />

      {/* 5. Subtotal and adjustments; rows that would be 0 are left out */}
      <View style={styles.summary}>
        {summaryRow('စုစုပေါင်း', amount(receipt.subtotal))}
        {!!receipt.discount && receipt.discount > 0 && summaryRow(discountLabel, `-${amount(receipt.discount)}`)}
        {!!receipt.markup && receipt.markup > 0 && summaryRow('Mark Up', `+${amount(receipt.markup)}`)}
        {!!receipt.serviceCharge &&
          receipt.serviceCharge > 0 &&
          summaryRow('ဝန်ဆောင်ခ', amount(receipt.serviceCharge))}
        {!!receipt.tax && receipt.tax > 0 && summaryRow('အခွန်', amount(receipt.tax))}
      </View>

      <View style={styles.dashedLine} />

      {/* 6. Total, large */}
      <View style={styles.totalRow}>
        <T style={[styles.totalText, size.totalLabel]}>ကျသင့်ငွေ</T>
        <T style={[styles.totalText, size.totalAmount]}>{amount(receipt.netTotal)}</T>
      </View>

      <View style={styles.dashedLine} />

      {/* 7. Payment */}
      <View style={styles.summary}>
        {!!receipt.paymentType && summaryRow('ငွေပေးချေမှု', receipt.paymentType)}
        {receipt.paidAmount !== undefined && summaryRow('ပေးငွေ', amount(receipt.paidAmount))}
        {!!receipt.changeAmount &&
          receipt.changeAmount > 0 &&
          summaryRow('ပြန်အမ်းငွေ', amount(receipt.changeAmount))}
        {!!receipt.dueAmount &&
          receipt.dueAmount > 0 &&
          summaryRow('ကျန်ငွေ (အကြွေး)', amount(receipt.dueAmount), true)}
      </View>

      <View style={styles.dashedLine} />

      {/* 8. Note and receipt details */}
      {!!receipt.note && <T style={[styles.note, size.body]}>မှတ်ချက်: {receipt.note}</T>}
      <View style={styles.spaced}>
        <T style={size.body}>ဘောင်ချာအမှတ်:</T>
        <T style={[styles.strong, size.body]}>{receipt.invoiceNo}</T>
      </View>
      <View style={styles.spaced}>
        <T style={size.body}>{receipt.date}</T>
        <T style={size.body}>ကျေးဇူးတင်ပါသည်</T>
      </View>

      {/* 9. Double line, the big sequence number and who printed it */}
      <View style={styles.doubleLine}>
        <View style={styles.solidLine} />
        <View style={styles.solidLine} />
      </View>
      {receipt.sequenceNumber != null && (
        <T style={[styles.sequence, size.sequence]}>#{String(receipt.sequenceNumber).padStart(4, '0')}</T>
      )}
      {!!receipt.cashierName && (
        <T style={[styles.centerText, size.body]}>ထုတ်ပေးသူ: {receipt.cashierName}</T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  font: {
    fontFamily: RECEIPT_FONT,
    color: '#000000',
    fontWeight: '500',
  },
  container: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  strong: {
    fontWeight: '500',
  },
  right: {
    textAlign: 'right',
  },
  center: {
    textAlign: 'center',
  },

  /* Header */
  header: {
    alignItems: 'center',
    marginBottom: 4,
  },
  logoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
  },
  logoLetter: {
    fontWeight: '500',
  },
  shopName: {
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
  },
  centerText: {
    textAlign: 'center',
    paddingHorizontal: 6,
  },

  /* Dividers */
  dashedLine: {
    borderBottomWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#000000',
    marginVertical: 8,
  },
  doubleLine: {
    gap: 3,
    marginTop: 10,
    marginBottom: 6,
  },
  solidLine: {
    borderBottomWidth: 2,
    borderColor: '#000000',
  },

  /* Customer */
  customer: {
    marginBottom: 6,
  },

  /* Items */
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  th: {
    fontWeight: '500',
    paddingBottom: 4,
  },
  items: {
    gap: 4,
  },
  nameCell: {
    flexShrink: 1,
  },
  td: {
    flexShrink: 1,
  },
  code: {
    fontWeight: '500',
  },

  /* Summary and payment rows */
  summary: {
    gap: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  summaryLabel: {
    width: '50%',
    textAlign: 'right',
  },
  summaryValue: {
    width: '32%',
    textAlign: 'right',
  },

  /* Total */
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalText: {
    fontWeight: '500',
  },

  /* Footer */
  note: {
    marginBottom: 4,
  },
  spaced: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  sequence: {
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 6,
  },
});
