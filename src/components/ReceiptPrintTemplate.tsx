import React from 'react';
import { StyleSheet, Text, TextProps, View } from 'react-native';

import { RECEIPT_FONT } from '../fonts';
import { ReceiptData } from '../services/receiptCaptureService';
import { useShopStore } from '../store/shopStore';

// Layout, sizes and weights follow offline-pos's receipt. Thermal printers print thin strokes faintly,
// hence black text at 700-900 weight. Sizes are in receipt pixels: the picture is 384 (58mm) or 576 (80mm) wide.

const MAX_PRINTED_ITEMS = 200;

interface Props {
  receipt: ReceiptData;
  paperWidth: 58 | 80;
}

const money = (value?: number) => `${Number(value ?? 0).toLocaleString('en-US')} MMK`;
const amount = (value?: number) => Number(value ?? 0).toLocaleString('en-US');

// Every line uses the Walone font
function T({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.font, style]} />;
}

export default function ReceiptPrintTemplate({ receipt, paperWidth }: Props) {
  const defaultShop = useShopStore((state) => state.shop);
  const is80mm = paperWidth === 80;

  const shopName = receipt.shopName || defaultShop.name;
  const shopAddress = receipt.shopAddress || defaultShop.address;
  const shopPhone = receipt.shopPhone || defaultShop.phone;
  const footerMessage = receipt.footerMessage || defaultShop.footerMessage || 'ဝယ်ယူအားပေးမှုကို အထူးပင် ကျေးဇူးတင်ရှိပါသည်';
  const items = receipt.items || [];

  const metaRow = (label: string, value?: string) =>
    value ? (
      <View style={styles.metaRow}>
        <T style={[styles.metaLabel, is80mm && styles.text80]}>{label}</T>
        <T style={[styles.metaValue, is80mm && styles.text80]}>{value}</T>
      </View>
    ) : null;

  const summaryRow = (label: string, value: string) => (
    <View style={styles.summaryRow}>
      <T style={[styles.summaryLabel, is80mm && styles.text80]}>{label}</T>
      <T style={[styles.summaryVal, is80mm && styles.text80]}>{value}</T>
    </View>
  );

  return (
    <View style={[styles.container, { width: is80mm ? 576 : 384, paddingBottom: is80mm ? 150 : 130 }]}>
      {/* 1. Shop header */}
      <View style={styles.headerBox}>
        <T style={[styles.storeTitle, is80mm && styles.storeTitle80]}>{shopName}</T>
        {!!shopPhone && <T style={[styles.storeContact, is80mm && styles.text80]}>ဖုန်း: {shopPhone}</T>}
        {!!shopAddress && <T style={[styles.storeAddress, is80mm && styles.text80]}>{shopAddress}</T>}
        <T style={[styles.receiptType, is80mm && styles.receiptType80]}>အရောင်းပြေစာ / Voucher</T>
      </View>

      <View style={styles.dashedLine} />

      {/* 2. Voucher details */}
      <View style={styles.metaSection}>
        {metaRow('ဘောင်ချာအမှတ်:', receipt.invoiceNo)}
        {metaRow('ရက်စွဲ:', receipt.date)}
        {metaRow('ဝယ်သူအမည်:', receipt.customerName)}
        {metaRow('အရောင်းဝန်ထမ်း:', receipt.cashierName)}
        {metaRow('ငွေပေးချေမှု:', receipt.paymentType)}
      </View>

      <View style={styles.dashedLine} />

      {/* 3. Column headers */}
      <View style={styles.tableHeaderRow}>
        <T style={[styles.thItem, is80mm && styles.text80]}>ပစ္စည်းအမည်</T>
        <T style={[styles.thQty, is80mm && styles.text80]}>အရေ</T>
        <T style={[styles.thPrice, is80mm && styles.text80]}>နှုန်း</T>
        <T style={[styles.thTotal, is80mm && styles.text80]}>ကျသင့်ငွေ</T>
      </View>

      <View style={styles.solidLine} />

      {/* 4. Items, one line each (capped so the picture stays within Android's maximum bitmap height) */}
      <View style={styles.itemsSection}>
        {items.slice(0, MAX_PRINTED_ITEMS).map((item, idx) => (
          <View key={idx} style={styles.itemRow}>
            <View style={styles.itemInfoCol}>
              <T style={[styles.itemName, is80mm && styles.itemName80]}>{item.name}</T>
            </View>
            <T style={[styles.itemQty, is80mm && styles.text80]}>{item.quantity ?? 0}</T>
            <T style={[styles.itemPrice, is80mm && styles.text80]}>{amount(item.price)}</T>
            <T style={[styles.itemSubTotal, is80mm && styles.itemSubTotal80]}>{amount(item.subTotal)}</T>
          </View>
        ))}
        {items.length > MAX_PRINTED_ITEMS && (
          <T style={[styles.itemName, is80mm && styles.itemName80]}>
            ... ကျန်ပစ္စည်း ({items.length - MAX_PRINTED_ITEMS} မျိုး)
          </T>
        )}
      </View>

      <View style={styles.dashedLine} />

      {/* 5. Totals */}
      <View style={styles.summarySection}>
        {summaryRow('စုစုပေါင်း (Subtotal):', money(receipt.subtotal))}
        {!!receipt.discount && receipt.discount > 0 && summaryRow('လျှော့ဈေး (Discount):', `- ${money(receipt.discount)}`)}
        {!!receipt.markup && receipt.markup > 0 && summaryRow('Mark Up:', `+ ${money(receipt.markup)}`)}
        {!!receipt.tax && receipt.tax > 0 && summaryRow('အခွန် (Tax):', `+ ${money(receipt.tax)}`)}

        <View style={[styles.summaryRow, styles.netTotalRow]}>
          <T style={[styles.netTotalLabel, is80mm && styles.netTotalLabel80]}>ကျသင့်ငွေ (Net Total):</T>
          <T style={[styles.netTotalVal, is80mm && styles.netTotalVal80]}>{money(receipt.netTotal)}</T>
        </View>

        {receipt.paidAmount !== undefined && summaryRow('ပေးသွင်းငွေ (Paid):', money(receipt.paidAmount))}
        {!!receipt.dueAmount && receipt.dueAmount > 0 && summaryRow('ကျန်ငွေ (Credit Due):', money(receipt.dueAmount))}
        {!!receipt.changeAmount &&
          receipt.changeAmount > 0 &&
          summaryRow('ပြန်အမ်းငွေ (Change):', money(receipt.changeAmount))}
      </View>

      <View style={styles.dashedLine} />

      {/* 6. Footer; the bottom padding keeps the cutter, which fires right after the picture, off this text */}
      <View style={styles.footerSection}>
        <T style={[styles.footerText, is80mm && styles.footerText80]}>{footerMessage}</T>
        <T style={[styles.footerSubText, is80mm && styles.footerSubText80]}>Thank you! Please come again.</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  font: {
    fontFamily: RECEIPT_FONT,
    color: '#000000',
  },
  container: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingTop: 10,
  },

  /* Header */
  headerBox: {
    alignItems: 'center',
    marginBottom: 8,
  },
  storeTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    lineHeight: 36,
  },
  storeTitle80: {
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 46,
  },
  storeContact: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'center',
    lineHeight: 24,
  },
  storeAddress: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
    lineHeight: 23,
    paddingHorizontal: 6,
  },
  receiptType: {
    fontSize: 16.5,
    fontWeight: '800',
    marginTop: 5,
    textAlign: 'center',
    lineHeight: 25,
  },
  receiptType80: {
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 30,
  },

  /* Dividers */
  dashedLine: {
    borderBottomWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#000000',
    marginVertical: 8,
  },
  solidLine: {
    borderBottomWidth: 2,
    borderColor: '#000000',
    marginBottom: 8,
  },

  /* Voucher details */
  metaSection: {
    gap: 4,
    paddingVertical: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  metaLabel: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  metaValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 24,
  },

  /* Column headers */
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
  },
  thItem: {
    flex: 2.2,
    fontSize: 16.5,
    fontWeight: '800',
    lineHeight: 24,
  },
  thQty: {
    flex: 0.7,
    fontSize: 16.5,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 24,
  },
  thPrice: {
    flex: 1.2,
    fontSize: 16.5,
    fontWeight: '800',
    textAlign: 'right',
    lineHeight: 24,
  },
  thTotal: {
    flex: 1.5,
    fontSize: 16.5,
    fontWeight: '800',
    textAlign: 'right',
    lineHeight: 24,
  },

  /* Items */
  itemsSection: {
    gap: 5,
    paddingVertical: 3,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemInfoCol: {
    flex: 2.2,
    paddingRight: 4,
  },
  itemName: {
    fontSize: 16.5,
    fontWeight: '700',
    lineHeight: 26,
  },
  itemName80: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 30,
  },
  itemQty: {
    flex: 0.7,
    fontSize: 16.5,
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: 1,
    lineHeight: 24,
  },
  itemPrice: {
    flex: 1.2,
    fontSize: 16.5,
    fontWeight: '700',
    textAlign: 'right',
    paddingTop: 1,
    lineHeight: 24,
  },
  itemSubTotal: {
    flex: 1.5,
    fontSize: 16.5,
    fontWeight: '800',
    textAlign: 'right',
    paddingTop: 1,
    lineHeight: 24,
  },
  itemSubTotal80: {
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 30,
  },

  /* Totals */
  summarySection: {
    gap: 4,
    paddingVertical: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 16.5,
    fontWeight: '700',
    lineHeight: 24,
  },
  summaryVal: {
    fontSize: 16.5,
    fontWeight: '800',
    lineHeight: 24,
  },
  netTotalRow: {
    paddingVertical: 7,
    marginVertical: 4,
    borderTopWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: '#000000',
  },
  netTotalLabel: {
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 28,
  },
  netTotalLabel80: {
    fontSize: 24,
    lineHeight: 34,
  },
  netTotalVal: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 29,
  },
  netTotalVal80: {
    fontSize: 25,
    lineHeight: 35,
  },

  /* Footer */
  footerSection: {
    alignItems: 'center',
    marginTop: 8,
    gap: 3,
  },
  footerText: {
    fontSize: 16.5,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 26,
  },
  footerText80: {
    fontSize: 20,
    lineHeight: 30,
  },
  footerSubText: {
    fontSize: 14.5,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
  },
  footerSubText80: {
    fontSize: 18,
    lineHeight: 26,
  },

  /* 80mm: plain lines scaled up */
  text80: {
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 28,
  },
});
