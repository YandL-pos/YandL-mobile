import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import type { CreditPersona } from '../../../../services/pos/types';
import { colors } from '../../theme';
import BottomSheet from '../BottomSheet';

interface Props {
  visible: boolean;
  personas: CreditPersona[];
  isLoading: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onAddNew: () => void;
  onClose: () => void;
}

export const customerLabel = (persona: CreditPersona) =>
  `${persona.name}${persona.phone ? ` - ${persona.phone}` : ''}`;

const matches = (persona: CreditPersona, query: string) =>
  [persona.name, persona.phone, persona.address].some((field) => (field || '').toLowerCase().includes(query));

export default function CustomerPicker({
  visible,
  personas,
  isLoading,
  selectedId,
  onSelect,
  onAddNew,
  onClose,
}: Props) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (normalized ? personas.filter((p) => matches(p, normalized)) : personas),
    [personas, normalized],
  );

  const choose = (id: string) => {
    onSelect(id);
    setQuery('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} title="အကြွေးပေးသူ ရွေးမယ်" onClose={onClose}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="အမည် သို့မဟုတ် ဖုန်းဖြင့် ရှာမယ်..."
          placeholderTextColor={colors.textFaint}
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.addButton} onPress={onAddNew}>
          <Text style={styles.addText}>+ အသစ်</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(persona) => persona._id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TouchableOpacity style={styles.item} onPress={() => choose('')}>
            <Text style={[styles.noneText, !selectedId && styles.selectedText]}>-- ရွေးချယ်ပါ -- (မရွေးပါ)</Text>
            {!selectedId && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>
        }
        renderItem={({ item }) => {
          const selected = item._id === selectedId;
          return (
            <TouchableOpacity style={[styles.item, selected && styles.itemSelected]} onPress={() => choose(item._id)}>
              <View style={styles.itemInfo}>
                <Text style={[styles.name, selected && styles.selectedText]}>{item.name}</Text>
                {!!item.phone && (
                  <Text style={styles.detail}>
                    {item.phone}
                    {item.address ? ` • ${item.address}` : ''}
                  </Text>
                )}
              </View>
              {selected && <Text style={styles.check}>✓</Text>}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={styles.empty} color={colors.primary} />
          ) : (
            <Text style={styles.empty}>
              {personas.length === 0 ? 'အကြွေးပေးသူ စာရင်း မရှိသေးပါ' : 'ရှာဖွေမှု မတွေ့ရှိပါ'}
            </Text>
          )
        }
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  addButton: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  list: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    borderRadius: 8,
  },
  itemSelected: {
    backgroundColor: colors.primarySoft,
  },
  itemInfo: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    color: colors.text,
  },
  detail: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  noneText: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  selectedText: {
    color: colors.primary,
    fontWeight: '700',
  },
  check: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
  },
  empty: {
    textAlign: 'center',
    color: colors.textFaint,
    paddingVertical: 32,
  },
});
