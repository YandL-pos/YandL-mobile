import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onPrinter: () => void;
  printerConnected: boolean;
  onNotifications: () => void;
  unreadNotifications: number;
  onHome: () => void;
  onLogout: () => void;
}

// Top bar matching the web app's header: back, page title, Home and Logout, plus the printer settings
export default function PosNavbar({
  title,
  subtitle,
  onBack,
  onPrinter,
  printerConnected,
  onNotifications,
  unreadNotifications,
  onHome,
  onLogout,
}: Props) {
  return (
    <View style={styles.bar}>
      <TouchableOpacity onPress={onBack} style={styles.back} hitSlop={8} accessibilityLabel="Back">
        <Ionicons name="arrow-back" size={24} color={colors.primary} />
      </TouchableOpacity>

      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      <TouchableOpacity onPress={onNotifications} style={styles.iconButton} accessibilityLabel="အသိပေးချက်များ (Notifications)">
        <Ionicons name="notifications-outline" size={18} color={colors.text} />
        {unreadNotifications > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={onPrinter} style={styles.iconButton} accessibilityLabel="Bluetooth ပရင်တာ (Printer)">
        <Ionicons name="print-outline" size={18} color={colors.text} />
        {printerConnected && <View style={styles.connectedDot} />}
      </TouchableOpacity>
      <TouchableOpacity onPress={onHome} style={styles.iconButton} accessibilityLabel="ပင်မစာမျက်နှာ (Home)">
        <Ionicons name="home-outline" size={18} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onLogout}
        style={[styles.iconButton, styles.logoutButton]}
        accessibilityLabel="အကောင့်ထွက်မည် (Logout)"
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  back: {
    padding: 4,
    marginLeft: -4,
  },
  titles: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textFaint,
    marginTop: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  logoutButton: {
    borderColor: '#fecaca',
  },
  // Unread low-stock alerts
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  // A printer is connected
  connectedDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
});
