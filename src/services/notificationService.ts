import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { router } from 'expo-router';

import { useNotificationSettingsStore } from '../store/notificationSettingsStore';
import { toast } from '../store/toastStore';

// Local phone notifications for low and out-of-stock products, ported from offline-pos.
// Builds made before expo-notifications was added don't have its native code; then alerts show as in-app toasts.

type NotificationsApi = typeof NotificationsModule;

let Notifications: NotificationsApi | null = null;
if (requireOptionalNativeModule('ExpoNotificationScheduler')) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications') as NotificationsApi;
}

// Android fixes a channel's sound once it exists, so "sound off" uses a second, silent channel
const CHANNEL_SOUND = 'low-stock-alerts';
const CHANNEL_SILENT = 'low-stock-alerts-silent';

// The page that opens when a notification is tapped
const NOTIFICATIONS_ROUTE = '/notifications';

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: useNotificationSettingsStore.getState().soundEnabled,
      shouldSetBadge: true,
    }),
  });
}

const present = async (title: string, body: string, data: Record<string, unknown>, vibrate: number[]) => {
  const { soundEnabled, vibrationEnabled } = useNotificationSettingsStore.getState();
  if (!Notifications) {
    toast.info(`${title} ${body}`);
    return;
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { screen: 'notifications', ...data },
      sound: soundEnabled,
      vibrate: vibrationEnabled ? vibrate : undefined,
    },
    trigger: Platform.OS === 'android' ? { channelId: soundEnabled ? CHANNEL_SOUND : CHANNEL_SILENT } : null,
  });
};

class NotificationService {
  private initialized = false;

  isNativeAvailable(): boolean {
    return !!Notifications;
  }

  // Loads settings, creates the Android channels and asks for permission (Android 13+ prompts)
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      await useNotificationSettingsStore.getState().loadSettings();
      if (!Notifications) return;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_SOUND, {
          name: 'Low Stock & Out of Stock Alerts',
          description: 'ပစ္စည်းလက်ကျန် နည်းခြင်းနှင့် ပြတ်လပ်ခြင်း သတိပေးချက်များ',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#ef4444',
        });
        await Notifications.setNotificationChannelAsync(CHANNEL_SILENT, {
          name: 'Low Stock Alerts (Silent)',
          description: 'အသံနှင့် တုန်ခါမှု မပါသော စတော့ သတိပေးချက်များ',
          importance: Notifications.AndroidImportance.HIGH,
          sound: null,
          enableVibrate: false,
        });
      }
      await this.requestPermission();
    } catch (err) {
      console.warn('NotificationService init failed:', err);
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!Notifications) return false;
    try {
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      const requested = await Notifications.requestPermissionsAsync();
      return requested.granted;
    } catch (err) {
      console.warn('Notification permission request failed:', err);
      return false;
    }
  }

  async sendLowStockNotification(productName: string, remainingQty: number): Promise<void> {
    if (!useNotificationSettingsStore.getState().enabled) return;
    await present(
      '⚠️ ပစ္စည်းလက်ကျန် နည်းနေပါပြီ!',
      `${productName} လက်ကျန် ${remainingQty} ခုသာ ကျန်ပါတော့သည်။ စစ်ဆေးဖြည့်တင်းရန် လိုအပ်ပါသည်။`,
      { filter: 'low_stock' },
      [0, 250, 250, 250],
    );
  }

  async sendOutOfStockNotification(productName: string): Promise<void> {
    const settings = useNotificationSettingsStore.getState();
    if (!settings.enabled || !settings.outOfStockAlert) return;
    await present(
      '🚨 ပစ္စည်း ပြတ်သွားပါပြီ!',
      `${productName} လက်ကျန် ကုန်သွားပါပြီ (၀ ခု)။ အမြန်ဖြည့်တင်းပါ။`,
      { filter: 'out_of_stock' },
      [0, 500, 200, 500],
    );
  }

  // One notification for a sale that left many products low, instead of one per product
  async sendSummaryNotification(outOfStock: number, lowStock: number): Promise<void> {
    if (!useNotificationSettingsStore.getState().enabled) return;
    const parts = [
      outOfStock > 0 ? `ပစ္စည်းပြတ် ${outOfStock} မျိုး` : '',
      lowStock > 0 ? `လက်ကျန်နည်း ${lowStock} မျိုး` : '',
    ].filter(Boolean);
    await present(
      outOfStock > 0 ? '🚨 စတော့ သတိပေးချက်' : '⚠️ စတော့ သတိပေးချက်',
      `${parts.join('၊ ')} ရှိနေပါပြီ။ အသိပေးချက်များတွင် စစ်ဆေးပါ။`,
      { filter: outOfStock > 0 ? 'out_of_stock' : 'low_stock' },
      outOfStock > 0 ? [0, 500, 200, 500] : [0, 250, 250, 250],
    );
  }

  // { success, isNative }: isNative is false on a build without the notification module
  async sendTestNotification(): Promise<{ success: boolean; isNative: boolean }> {
    await this.init();
    if (!Notifications) return { success: true, isNative: false };
    try {
      if (!(await this.requestPermission())) return { success: false, isNative: true };
      await present(
        '🔔 စမ်းသပ် သတိပေးချက် (Test Notification)',
        'YandN POS မှ စတော့အသိပေးချက် စနစ် အောင်မြင်စွာ အလုပ်လုပ်နေပါသည်!',
        { filter: 'all' },
        [0, 250, 250, 250],
      );
      return { success: true, isNative: true };
    } catch (err) {
      console.warn('Test notification failed:', err);
      return { success: false, isNative: true };
    }
  }

  // Tapping a notification opens the notification page, also when it started the app
  listenForTaps(): { remove: () => void } {
    if (!Notifications) return { remove: () => {} };
    const open = (data: unknown) => {
      if ((data as { screen?: string } | undefined)?.screen === 'notifications') router.push(NOTIFICATIONS_ROUTE);
    };
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) open(response.notification.request.content.data);
      })
      .catch(() => {});
    return Notifications.addNotificationResponseReceivedListener((response) =>
      open(response.notification.request.content.data),
    );
  }
}

export const notificationService = new NotificationService();
