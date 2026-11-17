import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { notificationService } from '../services/notificationService';
import { NotificationSettings, useNotificationSettingsStore } from '../store/notificationSettingsStore';
import { useStockAlertStore } from '../store/stockAlertStore';
import { toast } from '../store/toastStore';

// Layout and wording follow offline-pos's Settings › "စတော့ သတိပေးချက်များ" section
const PRIMARY = '#1b129c';
const THRESHOLD_PRESETS = [3, 5, 10, 15, 20];

const leave = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/');
};

export default function NotificationSettingsScreen() {
  const settings = useNotificationSettingsStore();
  const [customThreshold, setCustomThreshold] = useState(String(settings.lowStockThreshold));
  const [isSendingTest, setIsSendingTest] = useState(false);

  const update = async (patch: Partial<NotificationSettings>) => {
    await settings.updateSettings(patch);
    // The list was built with the old rules; rebuild it if it has been loaded
    if (useStockAlertStore.getState().isLoaded) useStockAlertStore.getState().loadAlerts();
  };

  const selectThreshold = async (num: number) => {
    const value = Math.max(1, Math.floor(num));
    setCustomThreshold(String(value));
    await update({ lowStockThreshold: value });
  };

  const saveCustomThreshold = async () => {
    const parsed = parseInt(customThreshold.replace(/[^0-9]/g, ''), 10);
    if (isNaN(parsed) || parsed < 1) {
      toast.error('အနည်းဆုံး ၁ ခုနှင့်အထက် ဂဏန်း ထည့်သွင်းပေးပါ။');
      setCustomThreshold(String(settings.lowStockThreshold || 5));
      return;
    }
    await selectThreshold(parsed);
    toast.success(`လက်ကျန်နည်း သတ်မှတ်ချက်ကို (${parsed} ခု) အဖြစ် ပြောင်းလဲသတ်မှတ်ပြီးပါပြီ။`);
  };

  const sendTest = async () => {
    if (isSendingTest) return;
    setIsSendingTest(true);
    const res = await notificationService.sendTestNotification();
    setIsSendingTest(false);
    if (res.success && res.isNative) {
      toast.success('Noti ပေးပို့ပြီးပါပြီ။ Notification Bar တွင် ကြည့်ပါ။');
    } else if (res.success) {
      toast.info('Notification Bar တွင် တက်စေရန် app build အသစ် (dev build / APK) လိုပါသည်။');
    } else {
      toast.error('ဖုန်း Settings တွင် Notification ခွင့်ပြုချက် (Allow Notifications) ဖွင့်ပေးပါ။');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={leave} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={PRIMARY} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <Text style={styles.headerTitle}>စတော့ သတိပေးချက်များ</Text>
          <Text style={styles.headerSubtitle}>ပစ္စည်းလက်ကျန် နည်းပါက ဖုန်း notification bar ကနေအသိပေးမယ်</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* 1. On / off */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>စတော့ သတိပေးချက်ဖွင့်မယ်</Text>
          <Text style={styles.cardSubtitle}>အရောင်းချုပ်ပြီးတဲ့အချိန် လက်ကျန်နည်းပါက ဖုန်းထဲ နိုတီတက်မယ်</Text>
          <OnOffRow value={settings.enabled} onLabel="သတိပေးချက်ဖွင့်ထားမယ်" onChange={(enabled) => update({ enabled })} />
        </View>

        {/* 2. Out of stock */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ပစ္စည်းပြတ်လတ်မှု သတိပေးချက်ဖွင့်မယ်</Text>
          <Text style={styles.cardSubtitle}>လက်ကျန်အရေအတွက် 0 ဖြစ်သွားမယ်ဆို alert နိုတီ ပို့မယ်</Text>
          <OnOffRow
            value={settings.outOfStockAlert}
            onLabel="သတိပေးချက်ဖွင့်ထားမယ်"
            onChange={(outOfStockAlert) => update({ outOfStockAlert })}
          />
        </View>

        {/* 3. Sound and vibration */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>အသံနဲ့ တုန်ခါမှု</Text>
          <Text style={styles.cardSubtitle}>နိုတီတက်ချိန်မှာ ဖုန်းအသံမြည်ခြင်းနဲ့ တုန်ခါမှု ဖွင့်ထားပါမယ်</Text>
          <OnOffRow
            value={settings.soundEnabled}
            onLabel="ဖွင့်ထားမယ်"
            onChange={(on) => update({ soundEnabled: on, vibrationEnabled: on })}
          />
        </View>

        {/* 4. Threshold */}
        <View style={styles.card}>
          <View style={styles.thresholdHeaderRow}>
            <View style={styles.thresholdTitle}>
              <Text style={styles.cardTitle}>စတော့ အနိမ့်ဆုံး သတ်မှတ်ချက်</Text>
              <Text style={[styles.cardSubtitle, styles.noMargin]}>
                လက်ကျန် {settings.lowStockThreshold} ခုနဲ့အောက်ရောက်ပါက နိုတီ တက်ပါမယ်
              </Text>
            </View>
            <TouchableOpacity style={styles.testButton} disabled={isSendingTest} activeOpacity={0.85} onPress={sendTest}>
              {isSendingTest ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View style={styles.pillContent}>
                  <Ionicons name="notifications-outline" size={16} color="#ffffff" />
                  <Text style={styles.testButtonText}>နိုတီအစမ်း ပို့ကြည့်မယ်</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.chipsRow}>
            {THRESHOLD_PRESETS.map((num) => {
              const selected = settings.lowStockThreshold === num;
              return (
                <TouchableOpacity
                  key={num}
                  style={[styles.chip, selected ? styles.selected : styles.unselected]}
                  onPress={() => selectThreshold(num)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={selected ? PRIMARY : '#94a3b8'}
                  />
                  <Text style={[styles.chipText, selected ? styles.chipTextSelected : styles.chipTextUnselected]}>{num} ခု</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.customRow}>
            <View style={styles.flex}>
              <Text style={styles.customLabel}>စိတ်ကြိုက် အရေအတွက် သတ်မှတ်ရန်:</Text>
              <Text style={styles.customSubLabel}>
                အပေါ်မှ နံပါတ်များအပြင် မိမိစိတ်ကြိုက် အရေအတွက် (ဥပမာ - 25, 50) ကိုလည်း ရိုက်ထည့်နိုင်ပါသည်
              </Text>
            </View>
            <View style={styles.customInputGroup}>
              <TextInput
                style={styles.customInput}
                value={customThreshold}
                onChangeText={(text) => setCustomThreshold(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={5}
                placeholder="5"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.customUnit}>ခု</Text>
              <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={saveCustomThreshold}>
                <Text style={styles.saveButtonText}>သတ်မှတ်မယ်</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.adviceBox}>
          <Ionicons name="bulb-outline" size={20} color="#d97706" style={styles.adviceIcon} />
          <Text style={styles.adviceText}>
            <Text style={styles.adviceStrong}>သတိပြုရန်: </Text>
            ဒီဖုန်းရဲ့ POS ကနေ ဘောင်ချာသိမ်းတဲ့အခါမှာ လက်ကျန်ကို စစ်ပြီး နိုတီ ပို့ပါတယ်။ တခြားဖုန်း ဒါမှမဟုတ် ကွန်ပျူတာကနေ
            ရောင်းတာကိုတော့ အသိပေးချက်များ စာမျက်နှာမှာ ပြန်စစ်ကြည့်နိုင်ပါတယ်။
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OnOffRow({ value, onLabel, onChange }: { value: boolean; onLabel: string; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.radioRow}>
      <Radio label={onLabel} selected={value} onPress={() => onChange(true)} />
      <Radio label="ပိတ်ထားမယ်" selected={!value} onPress={() => onChange(false)} />
    </View>
  );
}

function Radio({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.radioBox, selected ? styles.selected : styles.unselected]} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? PRIMARY : '#94a3b8'} />
      <Text style={[styles.radioLabel, selected ? styles.radioLabelSelected : styles.radioLabelUnselected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  headerSubtitle: { fontSize: 13, color: '#475569', marginTop: 2 },
  body: { padding: 16, gap: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  cardSubtitle: { fontSize: 13.5, color: '#64748b', marginBottom: 16 },
  noMargin: { marginBottom: 0 },
  radioRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  radioBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
  },
  selected: { borderColor: PRIMARY },
  unselected: { borderColor: '#cbd5e1' },
  radioLabel: { flex: 1, fontSize: 13.5 },
  radioLabelSelected: { fontWeight: '700', color: '#0f172a' },
  radioLabelUnselected: { color: '#64748b' },
  thresholdHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  thresholdTitle: { flex: 1, minWidth: 200, paddingRight: 10 },
  testButton: {
    backgroundColor: PRIMARY,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    elevation: 2,
  },
  pillContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  testButtonText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  chip: {
    flexGrow: 1,
    minWidth: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
  },
  chipText: { fontSize: 13 },
  chipTextSelected: { fontWeight: '700', color: '#0f172a' },
  chipTextUnselected: { fontWeight: '500', color: '#94a3b8' },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  customLabel: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  customSubLabel: { fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 18 },
  customInputGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customInput: {
    width: 72,
    height: 42,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    backgroundColor: '#ffffff',
    padding: 0,
  },
  customUnit: { fontSize: 14, fontWeight: '700', color: '#334155' },
  saveButton: { backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 14, height: 42, justifyContent: 'center' },
  saveButtonText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  adviceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fef3c7',
    backgroundColor: '#fffbeb',
  },
  adviceIcon: { marginTop: 1 },
  adviceText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#92400e' },
  adviceStrong: { fontWeight: '800', color: '#b45309' },
});
