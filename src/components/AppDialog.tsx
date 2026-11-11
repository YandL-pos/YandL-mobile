import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../features/pos/theme';
import { useDialogStore } from '../store/dialogStore';

// The confirm/message popup over every screen, in the app's own style instead of the system alert
export default function AppDialog() {
  const { id, dialog, close } = useDialogStore();
  if (!dialog) return null;

  const { title, message, confirmText = 'ရပါပြီ', cancelText, tone = 'default', onConfirm, onCancel } = dialog;

  const handleCancel = () => {
    close();
    onCancel?.();
  };

  const handleConfirm = () => {
    close();
    onConfirm?.();
  };

  return (
    <Modal key={id} visible transparent animationType="fade" statusBarTranslucent onRequestClose={handleCancel}>
      <View style={styles.backdrop}>
        {/* Tapping outside counts as cancel, like Android back */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.buttons}>
            {!!cancelText && (
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} activeOpacity={0.8}>
                <Text style={styles.cancelText}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.confirmButton, tone === 'danger' && styles.confirmDanger]}
              onPress={handleConfirm}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: 22,
    gap: 10,
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  message: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textMuted,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  confirmDanger: {
    backgroundColor: colors.danger,
  },
  confirmText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
