import { create } from 'zustand';
import RNFS from 'react-native-fs';

// Same settings and defaults as offline-pos, kept on the phone
export interface NotificationSettings {
  enabled: boolean;
  lowStockThreshold: number;
  outOfStockAlert: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  lowStockThreshold: 5,
  outOfStockAlert: true,
  soundEnabled: true,
  vibrationEnabled: true,
};

const SETTINGS_FILE_PATH = `${RNFS.DocumentDirectoryPath}/notification_settings.json`;

interface NotificationSettingsState extends NotificationSettings {
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<NotificationSettings>) => Promise<void>;
}

const pick = (source: Partial<NotificationSettings>): NotificationSettings => ({
  enabled: source.enabled ?? DEFAULT_NOTIFICATION_SETTINGS.enabled,
  lowStockThreshold: Math.max(1, Math.floor(source.lowStockThreshold ?? DEFAULT_NOTIFICATION_SETTINGS.lowStockThreshold)),
  outOfStockAlert: source.outOfStockAlert ?? DEFAULT_NOTIFICATION_SETTINGS.outOfStockAlert,
  soundEnabled: source.soundEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.soundEnabled,
  vibrationEnabled: source.vibrationEnabled ?? DEFAULT_NOTIFICATION_SETTINGS.vibrationEnabled,
});

export const useNotificationSettingsStore = create<NotificationSettingsState>((set, get) => ({
  ...DEFAULT_NOTIFICATION_SETTINGS,
  isLoaded: false,

  loadSettings: async () => {
    try {
      if (await RNFS.exists(SETTINGS_FILE_PATH)) {
        const saved = JSON.parse(await RNFS.readFile(SETTINGS_FILE_PATH, 'utf8'));
        set({ ...pick(saved), isLoaded: true });
        return;
      }
    } catch (err) {
      console.warn('Failed to load notification settings:', err);
    }
    set({ isLoaded: true });
  },

  updateSettings: async (patch) => {
    const updated = pick({ ...get(), ...patch });
    set(updated);
    try {
      await RNFS.writeFile(SETTINGS_FILE_PATH, JSON.stringify(updated, null, 2), 'utf8');
    } catch (err) {
      console.warn('Failed to save notification settings:', err);
    }
  },
}));
