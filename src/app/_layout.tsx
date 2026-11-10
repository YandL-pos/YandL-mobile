import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import GlobalReceiptCapturer from '../components/GlobalReceiptCapturer';
import Toast from '../components/Toast';
import { APP_FONTS } from '../fonts';
import { printerService } from '../services/printerService';
import { useAuthStore } from '../store/authStore';

export default function RootLayout() {
  // Not awaited: screens render at once; receipts printed later pick the font up
  useFonts(APP_FONTS);

  // Restore saved token and printer preferences, then reconnect to the saved printer
  useEffect(() => {
    useAuthStore.getState().hydrate();
    printerService
      .loadSavedConfig()
      .then(() => printerService.ensureConnected())
      .catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="printer" />
        <Stack.Screen name="pos/index" />
        {/* Popups over the product grid, which stays visible (dimmed) underneath */}
        <Stack.Screen name="pos/checkout" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen
          name="pos/success"
          options={{ presentation: 'transparentModal', animation: 'fade', gestureEnabled: false }}
        />
      </Stack>
      <Toast />

      {/* Draws receipts off screen for image-mode printing, from any screen */}
      <GlobalReceiptCapturer />
    </SafeAreaProvider>
  );
}
