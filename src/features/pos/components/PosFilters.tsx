import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { StorefrontProfile } from '../../../services/pos/types';
import type { StockFilter } from '../lib';
import { colors } from '../theme';
import OptionPickerSheet from './OptionPickerSheet';
import SearchBar from './SearchBar';

export const ALL_CATEGORIES = 'All';

const STOCK_FILTERS: { value: StockFilter; label: string }[] = [
  { value: 'All', label: 'လက်ကျန် အားလုံး' },
  { value: 'InStock', label: 'ပစ္စည်းရှိ (In Stock)' },
  { value: 'LowStock', label: 'နည်းနေ (Low Stock)' },
  { value: 'OutOfStock', label: 'ကုန်နေ (Out of Stock)' },
];

interface Props {
  storefronts: StorefrontProfile[];
  storefrontId: string | undefined;
  onStorefrontChange: (id: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  categories: string[];
  category: string;
  onCategoryChange: (category: string) => void;
  stockFilter: StockFilter;
  onStockFilterChange: (filter: StockFilter) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

// The web POS's filter grid: the storefront picker on its own row, then search | category
// and stock | refresh, two to a row
export default function PosFilters({
  storefronts,
  storefrontId,
  onStorefrontChange,
  search,
  onSearchChange,
  categories,
  category,
  onCategoryChange,
  stockFilter,
  onStockFilterChange,
  onRefresh,
  isRefreshing,
}: Props) {
  const [picker, setPicker] = useState<'storefront' | 'category' | 'stock' | null>(null);

  const storefrontOptions = storefronts.map((sf) => ({
    value: sf._id,
    label: sf.locationCode ? `${sf.locationName} (${sf.locationCode})` : sf.locationName,
  }));
  const storefrontLabel = storefronts.find((sf) => sf._id === storefrontId)?.locationName ?? 'Storefront ရွေးပါ';

  const categoryOptions = [
    { value: ALL_CATEGORIES, label: 'ပစ္စည်း အမျိုးအစားများ' },
    ...categories.map((c) => ({ value: c, label: c })),
  ];
  const categoryLabel = categoryOptions.find((o) => o.value === category)?.label ?? category;
  const stockLabel = STOCK_FILTERS.find((o) => o.value === stockFilter)?.label ?? '';

  return (
    <View style={styles.grid}>
      {storefronts.length > 0 && (
        <View style={styles.fullCell}>
          <Dropdown
            icon="storefront-outline"
            label={storefrontLabel}
            active
            onPress={() => setPicker('storefront')}
          />
        </View>
      )}
      <View style={styles.cell}>
        <SearchBar value={search} onChangeText={onSearchChange} />
      </View>
      <View style={styles.cell}>
        <Dropdown label={categoryLabel} active={category !== ALL_CATEGORIES} onPress={() => setPicker('category')} />
      </View>
      <View style={styles.cell}>
        <Dropdown label={stockLabel} active={stockFilter !== 'All'} onPress={() => setPicker('stock')} />
      </View>
      <View style={styles.cell}>
        <TouchableOpacity
          style={[styles.refresh, isRefreshing && styles.refreshBusy]}
          onPress={onRefresh}
          disabled={isRefreshing}
          activeOpacity={0.8}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="refresh" size={17} color={colors.primary} />
          )}
          <Text style={styles.refreshText}>ပြန်စစ်မယ်</Text>
        </TouchableOpacity>
      </View>

      <OptionPickerSheet
        visible={picker === 'storefront'}
        title="Storefront ရွေးချယ်ပါ"
        options={storefrontOptions}
        selected={storefrontId ?? ''}
        onSelect={onStorefrontChange}
        onClose={() => setPicker(null)}
      />
      <OptionPickerSheet
        visible={picker === 'category'}
        title="အမျိုးအစား ရွေးချယ်ပါ"
        options={categoryOptions}
        selected={category}
        onSelect={onCategoryChange}
        onClose={() => setPicker(null)}
      />
      <OptionPickerSheet
        visible={picker === 'stock'}
        title="လက်ကျန် ရွေးချယ်ပါ"
        options={STOCK_FILTERS}
        selected={stockFilter}
        onSelect={onStockFilterChange}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

function Dropdown({
  icon,
  label,
  active,
  onPress,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.dropdown, active && styles.dropdownActive]} onPress={onPress} activeOpacity={0.8}>
      {icon && <Ionicons name={icon} size={17} color={active ? colors.primary : colors.textMuted} />}
      <Text style={[styles.dropdownText, active && styles.dropdownTextActive]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={18} color={active ? colors.primary : colors.textMuted} />
    </TouchableOpacity>
  );
}

const CELL_HEIGHT = 48;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  // Two per row: half the width less half the gap
  cell: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 0,
  },
  fullCell: {
    flexBasis: '100%',
  },
  dropdown: {
    height: CELL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dropdownActive: {
    borderColor: colors.primary,
  },
  dropdownText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  dropdownTextActive: {
    color: colors.primary,
  },
  refresh: {
    height: CELL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  refreshBusy: {
    opacity: 0.7,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
