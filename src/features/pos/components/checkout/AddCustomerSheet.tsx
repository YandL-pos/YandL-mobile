import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { createCreditPersona } from '../../../../services/pos/posApi';
import type { CreditPersona } from '../../../../services/pos/types';
import { toast } from '../../../../store/toastStore';
import { colors } from '../../theme';
import BottomSheet from '../BottomSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (persona: CreditPersona) => void;
}

export default function AddCustomerSheet({ visible, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('အမည် ထည့်ပေးပါ');
      return;
    }
    if (!phone.trim()) {
      toast.error('ဖုန်းနံပါတ် ထည့်ပေးပါ');
      return;
    }
    setIsSaving(true);
    const res = await createCreditPersona({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim() || undefined,
    });
    setIsSaving(false);

    if (!res.success || !res.data) {
      toast.error(res.message || 'အကြွေးပေးသူ ထည့်၍ မရပါ');
      return;
    }
    toast.success('အကြွေးပေးသူ ထည့်ပြီးပါပြီ');
    setName('');
    setPhone('');
    setAddress('');
    onCreated(res.data);
  };

  return (
    <BottomSheet
      visible={visible}
      title="အကြွေးပေးသူ အသစ်"
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>မလုပ်တော့ပါ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.save} onPress={handleSave} disabled={isSaving}>
            {isSaving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>သိမ်းမယ်</Text>}
          </TouchableOpacity>
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>
          အမည် <Text style={styles.required}>*</Text>
        </Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="အမည်" />
        <Text style={styles.label}>
          ဖုန်း <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="09xxxxxxxxx"
          keyboardType="phone-pad"
        />
        <Text style={styles.label}>လိပ်စာ</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={address}
          onChangeText={setAddress}
          placeholder="(မထည့်လည်းရ)"
          multiline
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: {
    padding: 20,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 6,
  },
  required: {
    color: colors.danger,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
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
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.primary,
    fontWeight: '700',
  },
  save: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
