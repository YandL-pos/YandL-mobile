import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { resolveBranding } from '../features/pos/lib';
import { colors } from '../features/pos/theme';
import { getErrorMessage } from '../services/api/client';
import { printerService, toDevice, toDevices } from '../services/printerService';
import { useAuthStore } from '../store/authStore';
import { BluetoothDevice, usePrinterStore } from '../store/printerStore';
import { useShopStore } from '../store/shopStore';
import { toast } from '../store/toastStore';

// Layout, wording and colours follow offline-pos's "Bluetooth သာမိုပရင်တာ" settings page
const C = {
  page: '#f8fafc',
  border: '#e2e8f0',
  heading: '#0f172a',
  body: '#64748b',
  muted: '#94a3b8',
};

const leave = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/');
};

export default function PrinterSettingsScreen() {
  const {
    connectedPrinter,
    pairedDevices,
    foundDevices,
    isScanning,
    isConnecting,
    paperWidth,
    printMode,
    autoPrint,
    setPaperWidth,
    setPrintMode,
    setAutoPrint,
  } = usePrinterStore();
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [scanHint, setScanHint] = useState('');
  const available = printerService.isAvailable();

  // Paired printers show at once; found ones appear one by one while a search runs
  useEffect(() => {
    printerService.getPairedDevices();
    const store = usePrinterStore.getState();
    const subscriptions = [
      DeviceEventEmitter.addListener('EVENT_DEVICE_FOUND', (data: { device?: unknown }) => {
        const device = toDevice(data?.device);
        if (device) store.addFoundDevice(device);
      }),
      DeviceEventEmitter.addListener('EVENT_DEVICE_ALREADY_PAIRED', (data: { devices?: unknown }) => {
        const devices = toDevices(data?.devices);
        if (devices.length > 0) store.setPairedDevices(devices);
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  const savePreference = (apply: () => void) => {
    apply();
    printerService.savePreferences();
  };

  const handleScan = async () => {
    setScanHint('');
    try {
      const result = await printerService.scanDevices();
      if (!result.discoveryStarted) {
        setScanHint(
          'ပရင်တာအသစ် ရှာလို့ မရပါ (NOT_STARTED)။ ဖုန်းရဲ့ Location (GPS) ကို ဖွင့်ပြီး ပြန်ရှာပါ။ Pair လုပ်ထားပြီးသား ပရင်တာတွေကတော့ အောက်မှာ ပြထားပါတယ်။',
        );
      } else if (result.paired.length === 0 && result.found.length === 0) {
        setScanHint('ပရင်တာ မတွေ့ပါ။ ပရင်တာ ဖွင့်ထားပြီး ဖုန်းနားမှာ ရှိမရှိ စစ်ပါ။');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'ရှာဖွေ၍ မရပါ'));
    }
  };

  const handleConnect = async (device: BluetoothDevice) => {
    setConnectingAddress(device.address);
    try {
      await printerService.connect(device);
      toast.success(`"${device.name || device.address}" နှင့် ချိတ်ဆက်ပြီးပါပြီ`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'ချိတ်ဆက်မှု မအောင်မြင်ပါ။ ပရင်တာ ဖွင့်ထားမထား စစ်ပါ။'));
    } finally {
      setConnectingAddress(null);
    }
  };

  const handleDisconnect = async () => {
    await printerService.disconnect();
    toast.info('Printer နှင့် ချိတ်ဆက်မှု ဖြုတ်ပြီးပါပြီ');
  };

  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    try {
      const shop = useShopStore.getState();
      if (!shop.settings) await shop.loadSettings();
      const { settings, receiptSlot } = useShopStore.getState();
      await printerService.testPrint({
        ...resolveBranding(settings, receiptSlot),
        cashierName: useAuthStore.getState().userName ?? undefined,
      });
      toast.success('Test Print ပို့ပြီးပါပြီ');
    } catch (err) {
      toast.error(getErrorMessage(err, 'ပုံနှိပ်၍ မရပါ'));
    } finally {
      setIsTestPrinting(false);
    }
  };

  const renderDevice = (device: BluetoothDevice) => {
    const isCurrent = connectedPrinter?.address === device.address;
    return (
      <TouchableOpacity
        key={device.address}
        style={styles.deviceRow}
        onPress={() => !isCurrent && handleConnect(device)}
        disabled={isConnecting || isCurrent}
        activeOpacity={0.7}
      >
        <View style={styles.flex}>
          <Text style={styles.deviceName}>{device.name || 'Unknown Device'}</Text>
          <Text style={styles.deviceAddress}>{device.address}</Text>
        </View>
        <View style={[styles.connectPill, isCurrent && styles.connectPillActive]}>
          {connectingAddress === device.address ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.connectPillText, isCurrent && styles.connectPillTextActive]}>
              {isCurrent ? 'Connected' : 'Connect'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={leave} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <Text style={styles.headerTitle}>Bluetooth သာမိုပရင်တာ</Text>
          <Text style={styles.headerSubtitle}>ESC/POS 58mm / Printer ချိတ်ဆက်ရန်</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {!available && (
          <View style={[styles.adviceBox, styles.warnBox]}>
            <Ionicons name="warning-outline" size={20} color={colors.danger} />
            <Text style={[styles.adviceText, styles.warnText]}>
              Bluetooth ပရင်တာကို Android app build (dev build / APK) မှာပဲ သုံးလို့ရပါတယ်။
            </Text>
          </View>
        )}

        {/* 1. Printer ချိတ်မယ် */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Printer ချိတ်မယ်</Text>

          {connectedPrinter ? (
            <View style={styles.connectedBox}>
              <View style={styles.flex}>
                <Text style={styles.connectedLabel}>လက်ရှိ ချိတ်ဆက်ထားသော Printer:</Text>
                <Text style={styles.connectedName}>{connectedPrinter.name}</Text>
                <Text style={styles.deviceAddress}>{connectedPrinter.address}</Text>
              </View>
              <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect} activeOpacity={0.8}>
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.statusText}>Printer ချိတ်ဆက်ထားခြင်းမရှိသေးပါ</Text>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.findButton, (isScanning || !available) && styles.dimmed]}
              onPress={handleScan}
              disabled={isScanning || !available}
              activeOpacity={0.85}
            >
              {isScanning ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View style={styles.pillContent}>
                  <Ionicons name="bluetooth" size={18} color="#ffffff" />
                  <Text style={styles.findText}>Printer ရှာမယ်</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.testButton, isTestPrinting && styles.dimmed]}
              onPress={handleTestPrint}
              disabled={isTestPrinting}
              activeOpacity={0.85}
            >
              {isTestPrinting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View style={styles.pillContent}>
                  <Ionicons name="print-outline" size={18} color={colors.primary} />
                  <Text style={styles.testText}>Test Print စမ်းမယ်</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {isScanning && (
            <View style={styles.scanningBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.scanningText}>အနီးအနားရှိ Bluetooth ကိရိယာများကို ရှာဖွေနေပါသည်...</Text>
            </View>
          )}
          {!!scanHint && <Text style={styles.scanHint}>{scanHint}</Text>}

          {pairedDevices.length > 0 && (
            <View style={styles.deviceList}>
              <Text style={styles.listTitle}>ချိတ်ဆက်ပြီးသား ကိရိယာများ (Paired Devices):</Text>
              {pairedDevices.map(renderDevice)}
            </View>
          )}
          {foundDevices.length > 0 && (
            <View style={styles.deviceList}>
              <Text style={styles.listTitle}>အနီးအနား တွေ့ရှိသော ကိရိယာများ (Discovered Devices):</Text>
              {foundDevices.map(renderDevice)}
            </View>
          )}
        </View>

        {/* 2. စက္ကူ အရွယ်အစား */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>စက္ကူ အရွယ်အစား ချိန်မယ်</Text>
          <Text style={styles.cardSubtitle}>Paper Size ရွေးမယ်</Text>
          <View style={styles.radioRow}>
            <RadioOption
              label="80 mm (ဆိုင်သုံး ပရင်တာ)"
              selected={paperWidth === 80}
              onPress={() => savePreference(() => setPaperWidth(80))}
            />
            <RadioOption
              label="58 mm (လက်ကိုင် မီနီပရင်တာ)"
              selected={paperWidth === 58}
              onPress={() => savePreference(() => setPaperWidth(58))}
            />
          </View>
        </View>

        {/* 3. ရိုက်နှိပ်မည့် ပုံစံ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ရိုက်နှိပ်မည့် ပုံစံ</Text>
          <Text style={styles.cardSubtitle}>Print Mode ရွေးမယ်</Text>
          <View style={styles.radioRow}>
            <RadioOption
              label="ရုပ်ပုံစနစ် (မြန်မာစာ အပြည့်အဝပေါ်ပါတယ်)"
              selected={printMode === 'image'}
              onPress={() => savePreference(() => setPrintMode('image'))}
            />
            <RadioOption
              label="စာသားစနစ် (မြန်မာစာ မပေါ်ပါ)"
              selected={printMode === 'text'}
              onPress={() => savePreference(() => setPrintMode('text'))}
            />
          </View>
        </View>

        {/* 4. Auto print (not in offline-pos) */}
        <View style={[styles.card, styles.switchCard]}>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>ရောင်းပြီးတာနဲ့ အလိုလို ထုတ်မယ်</Text>
            <Text style={[styles.cardSubtitle, styles.noMargin]}>
              ဘောင်ချာသိမ်းပြီးတာနဲ့ receipt ထုတ်ပေးမယ် (Auto print)
            </Text>
          </View>
          <Switch
            value={autoPrint}
            onValueChange={(enabled) => savePreference(() => setAutoPrint(enabled))}
            trackColor={{ true: colors.primary, false: '#cbd5e1' }}
          />
        </View>

        <View style={styles.adviceBox}>
          <Ionicons name="bulb-outline" size={20} color="#d97706" style={styles.adviceIcon} />
          <Text style={styles.adviceText}>
            <Text style={styles.adviceStrong}>အကြံပြုချက်: </Text>
            ပရင်တာ အမည် မပေါ်ပါက ဖုန်း Settings › Bluetooth ထဲတွင် ပရင်တာကို အရင်ဆုံး Pair ပြုလုပ်ပေးပါ။
            ထို့နောက် ဖုန်း၏ တည်နေရာ (GPS / Location) ဖွင့်ထားပေးပါ။
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RadioOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.radioBox, selected ? styles.radioBoxSelected : styles.radioBoxUnselected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={selected ? colors.primary : C.muted}
      />
      <Text style={[styles.radioLabel, selected ? styles.radioLabelSelected : styles.radioLabelUnselected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: C.page,
  },
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.heading,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  body: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: C.border,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.heading,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13.5,
    color: C.body,
    marginBottom: 16,
  },
  noMargin: {
    marginBottom: 0,
  },
  connectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  connectedLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#16a34a',
  },
  connectedName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: C.heading,
    marginTop: 1,
  },
  disconnectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  disconnectText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
  },
  statusText: {
    fontSize: 13.5,
    color: C.body,
    marginTop: 4,
    marginBottom: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  findButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  testButton: {
    flex: 1.1,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  findText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  testText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  dimmed: {
    opacity: 0.7,
  },
  scanningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
  },
  scanningText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
  },
  scanHint: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fffbeb',
    color: '#92400e',
    fontSize: 13,
    lineHeight: 19,
    overflow: 'hidden',
  },
  deviceList: {
    marginTop: 16,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.page,
  },
  deviceName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: C.heading,
  },
  deviceAddress: {
    fontSize: 11.5,
    color: C.body,
    marginTop: 1,
  },
  connectPill: {
    minWidth: 84,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: colors.primary,
    backgroundColor: '#ffffff',
  },
  connectPillActive: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  connectPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  connectPillTextActive: {
    color: '#16a34a',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
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
  radioBoxSelected: {
    borderColor: colors.primary,
  },
  radioBoxUnselected: {
    borderColor: '#cbd5e1',
  },
  radioLabel: {
    flex: 1,
    fontSize: 13.5,
  },
  radioLabelSelected: {
    fontWeight: '700',
    color: C.heading,
  },
  radioLabelUnselected: {
    color: C.body,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
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
  adviceIcon: {
    marginTop: 1,
  },
  adviceText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#92400e',
  },
  adviceStrong: {
    fontWeight: '800',
    color: '#b45309',
  },
  warnBox: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  warnText: {
    color: colors.danger,
  },
});
