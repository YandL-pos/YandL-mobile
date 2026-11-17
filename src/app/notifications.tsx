import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { countAlerts, StockAlertItem } from '../features/notifications/lib/stockAlerts';
import { TABLET_MIN_WIDTH } from '../features/pos/theme';
import { webBridge } from '../services/webBridge';
import { useNotificationSettingsStore } from '../store/notificationSettingsStore';
import { useStockAlertStore, useUnreadAlertCount } from '../store/stockAlertStore';
import { toast } from '../store/toastStore';

// Layout, wording and colours follow offline-pos's NotificationScreen
const PRIMARY = '#1b129c';
const ITEMS_PER_PAGE = 50;

type FilterType = 'all' | 'unread' | 'out_of_stock' | 'low_stock';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const leave = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/');
};

// Close the native screens and show this page of the web app underneath
const showWebPage = (path: string) => {
  webBridge.navigate(path);
  if (router.canDismiss()) router.dismissAll();
  else router.replace('/');
};

const openSettings = () => router.push('/notification-settings');

export default function NotificationScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;

  const { alerts, readIds, isLoading, isLoaded, error, storefront, loadAlerts, markAsRead, markAllAsRead } =
    useStockAlertStore();
  const unreadCount = useUnreadAlertCount();
  const notifEnabled = useNotificationSettingsStore((s) => s.enabled);
  const lowStockThreshold = useNotificationSettingsStore((s) => s.lowStockThreshold) || 5;
  const { outOfStock: outOfStockCount, lowStock: lowStockCount, total: totalAlertCount } = countAlerts(alerts);

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // The full list loads when the page opens; there is no background polling
  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const changeFilter = (filter: FilterType) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const changeSearch = (text: string) => {
    setSearchQuery(text);
    setCurrentPage(1);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAlerts();
    setIsRefreshing(false);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    toast.success('သတိပေးချက် အားလုံးကို ဖတ်ပြီးအဖြစ် မှတ်သားပြီးပါပြီ။');
  };

  const handleGoToInventory = (item: StockAlertItem) => {
    markAsRead(item.productId);
    showWebPage('/inventory');
  };

  const handleOrderStock = (item: StockAlertItem) => {
    markAsRead(item.productId);
    showWebPage('/purchasing');
  };

  const filterOptions: { key: FilterType; label: string; icon: IoniconName }[] = [
    { key: 'all', label: `အားလုံး (${totalAlertCount})`, icon: 'notifications-outline' },
    { key: 'unread', label: `မဖတ်ရသေးသော (${unreadCount})`, icon: 'mail-unread-outline' },
    { key: 'out_of_stock', label: `ပစ္စည်းပြတ် (${outOfStockCount})`, icon: 'alert-circle-outline' },
    { key: 'low_stock', label: `လက်ကျန်နည်း (${lowStockCount})`, icon: 'warning-outline' },
  ];

  const readIdSet = useMemo(() => new Set(readIds), [readIds]);

  const filteredAlerts = useMemo(() => {
    let result = alerts;
    if (activeFilter === 'unread') result = result.filter((a) => !readIdSet.has(a.id));
    else if (activeFilter === 'out_of_stock') result = result.filter((a) => a.type === 'out_of_stock');
    else if (activeFilter === 'low_stock') result = result.filter((a) => a.type === 'low_stock');

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (a) =>
          a.productName.toLowerCase().includes(q) ||
          a.productCode.toLowerCase().includes(q) ||
          a.categoryName.toLowerCase().includes(q),
      );
    }
    return result;
  }, [alerts, activeFilter, searchQuery, readIdSet]);

  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const paginatedAlerts = filteredAlerts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const renderPaginationFooter = () => {
    if (filteredAlerts.length === 0) return null;
    const showingStart = (page - 1) * ITEMS_PER_PAGE + 1;
    const showingEnd = Math.min(page * ITEMS_PER_PAGE, filteredAlerts.length);

    const pageNumbers: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      pageNumbers.push(1);
      if (page > 3) pageNumbers.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pageNumbers.push(i);
      if (page < totalPages - 2) pageNumbers.push('...');
      pageNumbers.push(totalPages);
    }

    return (
      <View style={styles.paginationFooter}>
        <Text style={styles.paginationSummaryText}>
          စုစုပေါင်း <Text style={styles.paginationBoldText}>{filteredAlerts.length}</Text> ခု အနက်{' '}
          <Text style={styles.paginationBoldText}>
            {showingStart} - {showingEnd}
          </Text>{' '}
          ကို ပြသနေပါသည်
        </Text>

        <View style={styles.paginationControlsRow}>
          <TouchableOpacity
            style={[styles.pageNavBtn, page === 1 && styles.pageNavBtnDisabled]}
            disabled={page === 1}
            onPress={() => setCurrentPage(Math.max(1, page - 1))}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={16} color={page === 1 ? '#94a3b8' : '#334155'} />
            <Text style={[styles.pageNavBtnText, page === 1 && styles.pageNavBtnTextDisabled]}>ရှေ့သို့</Text>
          </TouchableOpacity>

          <View style={styles.pageNumbersGroup}>
            {pageNumbers.map((pg, idx) =>
              typeof pg === 'string' ? (
                <Text key={`ellipsis-${idx}`} style={styles.pageEllipsisText}>
                  {pg}
                </Text>
              ) : (
                <TouchableOpacity
                  key={`page-${pg}`}
                  style={[styles.pageNumberBtn, page === pg && styles.pageNumberBtnActive]}
                  onPress={() => setCurrentPage(pg)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pageNumberBtnText, page === pg && styles.pageNumberBtnTextActive]}>{pg}</Text>
                </TouchableOpacity>
              ),
            )}
          </View>

          <TouchableOpacity
            style={[styles.pageNavBtn, page === totalPages && styles.pageNavBtnDisabled]}
            disabled={page === totalPages}
            onPress={() => setCurrentPage(Math.min(totalPages, page + 1))}
            activeOpacity={0.7}
          >
            <Text style={[styles.pageNavBtnText, page === totalPages && styles.pageNavBtnTextDisabled]}>နောက်သို့</Text>
            <Ionicons name="chevron-forward" size={16} color={page === totalPages ? '#94a3b8' : '#334155'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if ((isLoading && !isRefreshing) || !isLoaded) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>အသိပေးချက်များ ရှာဖွေနေပါသည်...</Text>
        </View>
      );
    }

    if (!notifEnabled) {
      return (
        <View style={styles.emptyStateCard}>
          <Ionicons name="notifications-off-outline" size={54} color={PRIMARY} />
          <Text style={styles.emptyStateTitle}>{'စတော့ သတိပေးချက်စနစ်ကို\nပိတ်ထားပါသည်'}</Text>
          <TouchableOpacity style={styles.emptyStateBtn} activeOpacity={0.85} onPress={openSettings}>
            <Ionicons name="settings-outline" size={19} color="#ffffff" />
            <Text style={styles.emptyStateBtnText}>ဆက်တင်တွင် ပြန်ဖွင့်မယ်</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (error && alerts.length === 0) {
      return (
        <View style={styles.emptyStateCard}>
          <Ionicons name="cloud-offline-outline" size={54} color={PRIMARY} />
          <Text style={styles.emptyStateTitle}>{'အသိပေးချက်များ ရယူ၍\nမရပါ'}</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.emptyStateBtn} activeOpacity={0.85} onPress={handleRefresh}>
            <Ionicons name="refresh" size={19} color="#ffffff" />
            <Text style={styles.emptyStateBtnText}>ပြန်စစ်မယ်</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (filteredAlerts.length === 0) {
      return (
        <View style={styles.emptyStateCard}>
          <Ionicons
            name={activeFilter === 'unread' ? 'checkmark-circle-outline' : 'library-outline'}
            size={54}
            color={PRIMARY}
          />
          <Text style={styles.emptyStateTitle}>
            {activeFilter === 'unread'
              ? 'မဖတ်ရသေးသော သတိပေးချက်\nမရှိတော့ပါ'
              : searchQuery.trim()
                ? 'ရှာဖွေထားသော ပစ္စည်း\nမတွေ့ရှိပါ'
                : 'လက်တလော ပစ္စည်း\nပြတ်လတ်မှု မရှိသေးပါ'}
          </Text>
          <TouchableOpacity style={styles.emptyStateBtn} activeOpacity={0.85} onPress={() => showWebPage('/inventory')}>
            <Ionicons name="storefront-outline" size={19} color="#ffffff" />
            <Text style={styles.emptyStateBtnText}>ဆိုင်ပစ္စည်း စာရင်းနှင့် စတော့ကြည့်မယ်</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.tableCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScrollContent}>
          <View style={[styles.tableInner, { minWidth: isTablet ? '100%' : 789 }]}>
            <View style={styles.tableHeaderRow}>
              <View style={styles.colNo}>
                <Text style={styles.th}>No</Text>
              </View>
              <View style={styles.colName}>
                <Text style={styles.th}>Name</Text>
              </View>
              <View style={styles.colCategory}>
                <Text style={styles.th}>Category</Text>
              </View>
              <View style={styles.colPrice}>
                <Text style={[styles.th, styles.alignRight]}>Price</Text>
              </View>
              <View style={styles.colStock}>
                <Text style={styles.th}>Stock / Status</Text>
              </View>
              <View style={styles.colActions}>
                <Text style={[styles.th, styles.alignCenter]}>Actions</Text>
              </View>
            </View>

            <FlatList
              data={paginatedAlerts}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item, index }) => {
                const isOutOfStock = item.type === 'out_of_stock';
                const isUnread = !readIdSet.has(item.id);
                const rowNumber = String((page - 1) * ITEMS_PER_PAGE + index + 1).padStart(2, '0');
                return (
                  <TouchableOpacity
                    style={[styles.tableRow, { backgroundColor: isOutOfStock ? '#fef2f2' : '#fefce8' }]}
                    activeOpacity={0.85}
                    onPress={() => markAsRead(item.productId)}
                  >
                    <View style={styles.colNo}>
                      <View style={styles.noColCell}>
                        {isUnread && <View style={styles.unreadDot} />}
                        <Text style={styles.tdNo}>{rowNumber}</Text>
                      </View>
                    </View>

                    <View style={styles.colName}>
                      <Text style={styles.tdName}>{item.productName}</Text>
                      {!!item.productCode && <Text style={styles.tdCodeSub}>{item.productCode}</Text>}
                    </View>

                    <View style={styles.colCategory}>
                      <Text style={styles.tdCategory} numberOfLines={2}>
                        {item.categoryName || '-'}
                      </Text>
                    </View>

                    <View style={styles.colPrice}>
                      <Text style={styles.tdPrice}>{item.sellingPrice.toLocaleString('en-US')}</Text>
                      <Text style={styles.tdMmkUnit}>MMK</Text>
                    </View>

                    <View style={styles.colStock}>
                      <Text style={[styles.tdStock, { color: isOutOfStock ? '#dc2626' : '#b45309' }]}>
                        {item.stockQty} PCS
                      </Text>
                      <View style={isOutOfStock ? styles.statusOutBadge : styles.statusLowBadge}>
                        <Text style={isOutOfStock ? styles.statusOutBadgeText : styles.statusLowBadgeText}>
                          {isOutOfStock ? 'ပစ္စည်းပြတ်' : 'လက်ကျန်နည်း'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.colActions}>
                      <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={() => handleGoToInventory(item)}>
                        <Text style={styles.actionBtnText}>ကြည့်မယ်</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={() => handleOrderStock(item)}>
                        <Text style={styles.actionBtnText}>မှာမယ်</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </ScrollView>
        {renderPaginationFooter()}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={leave} hitSlop={10} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={24} color={PRIMARY} />
          </TouchableOpacity>
          <View style={styles.flex}>
            <Text style={styles.headerTitle}>အသိပေးချက်များ</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {storefront
                ? `${storefront.locationName} · စတော့လက်ကျန် သတိပေးချက်များ`
                : 'စတော့လက်ကျန်နှင့် အရေးကြီး သတိပေးချက်များ'}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[PRIMARY]} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search, mark all read and refresh */}
          <View style={styles.topControlsRow}>
            <View style={styles.searchPill}>
              <Ionicons name="search" size={20} color="#64748b" />
              <TextInput
                style={styles.searchInput}
                placeholder="ပစ္စည်းအမည်၊ ကုဒ် သို့မဟုတ် အမျိုးအစား ရှာမယ်..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={changeSearch}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => changeSearch('')}>
                  <Ionicons name="close-circle" size={17} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.topRightActionsRow}>
              {unreadCount > 0 && (
                <TouchableOpacity style={styles.markReadPillBtn} onPress={handleMarkAllAsRead} activeOpacity={0.75}>
                  <Ionicons name="checkmark-done" size={18} color="#047857" />
                  <Text style={styles.markReadPillBtnText}>အားလုံးဖတ်ပြီး ({unreadCount})</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.refreshPillBtn}
                onPress={handleRefresh}
                activeOpacity={0.75}
                disabled={isRefreshing || isLoading}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color={PRIMARY} />
                ) : (
                  <Ionicons name="refresh" size={18} color={PRIMARY} />
                )}
                <Text style={styles.refreshPillBtnText}>ပြန်စစ်မယ်</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionDivider} />

          {/* Summary cards */}
          <View style={[styles.statsRow, { flexDirection: isTablet ? 'row' : 'column' }]}>
            <TouchableOpacity
              style={[styles.statCard, activeFilter === 'out_of_stock' && styles.statCardActive]}
              activeOpacity={0.8}
              onPress={() => changeFilter(activeFilter === 'out_of_stock' ? 'all' : 'out_of_stock')}
            >
              <Text style={styles.statLabel}>ပစ္စည်းပြတ် စတော့များ</Text>
              <Text style={[styles.statValue, outOfStockCount > 0 && styles.statValueDanger]}>{outOfStockCount} မျိုး</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statCard, activeFilter === 'low_stock' && styles.statCardActive]}
              activeOpacity={0.8}
              onPress={() => changeFilter(activeFilter === 'low_stock' ? 'all' : 'low_stock')}
            >
              <Text style={styles.statLabel}>လက်ကျန်နည်းနေတဲ့ စတော့ (≤ {lowStockThreshold} ခု)</Text>
              <Text style={[styles.statValue, lowStockCount > 0 && styles.statValueWarning]}>{lowStockCount} မျိုး</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statCard, activeFilter === 'all' && styles.statCardActive]}
              activeOpacity={0.8}
              onPress={() => changeFilter('all')}
            >
              <Text style={styles.statLabel}>သတိပေးချက် စုစုပေါင်း</Text>
              <Text style={styles.statValue}>
                {totalAlertCount === 0
                  ? 'မရှိသေးပါ'
                  : `${totalAlertCount} ခု ${unreadCount > 0 ? `(မဖတ်ရသေး ${unreadCount})` : ''}`}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <View style={styles.filterSection}>
            <View style={styles.filterHeaderRow}>
              <Text style={styles.filterSectionTitle}>Filters များ:</Text>
              <TouchableOpacity style={styles.settingsShortcutBtn} activeOpacity={0.75} onPress={openSettings}>
                <Ionicons name="settings-outline" size={16} color="#4338ca" />
                <Text style={styles.settingsShortcutText}>လက်ကျန်နည်း သတ်မှတ်ချက်: ≤ {lowStockThreshold} ခု (ပြင်ရန်)</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
              {filterOptions.map((f) => {
                const active = activeFilter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.filterPill, active ? styles.filterPillActive : styles.filterPillInactive]}
                    activeOpacity={0.75}
                    onPress={() => changeFilter(f.key)}
                  >
                    <Ionicons name={f.icon} size={16} color={active ? PRIMARY : '#64748b'} />
                    <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : styles.filterPillTextInactive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {renderContent()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
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
  container: { flex: 1, backgroundColor: '#ffffff' },
  contentContainer: { padding: 16 },
  alignRight: { textAlign: 'right' },
  alignCenter: { textAlign: 'center' },

  /* Top controls */
  topControlsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  searchPill: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#94a3b8',
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13.5, color: '#0f172a', padding: 0 },
  topRightActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  markReadPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  markReadPillBtnText: { fontSize: 13, fontWeight: '700', color: '#047857' },
  refreshPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: '#eef2ff',
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  refreshPillBtnText: { fontSize: 13.5, fontWeight: '700', color: PRIMARY },
  sectionDivider: { height: 1, backgroundColor: '#e2e8f0', marginBottom: 16 },

  /* Summary cards */
  statsRow: { gap: 12, marginBottom: 18 },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  statCardActive: { borderColor: PRIMARY, borderWidth: 1.5, backgroundColor: '#fafbff' },
  statLabel: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 6 },
  statValueDanger: { color: '#dc2626' },
  statValueWarning: { color: '#d97706' },

  /* Filters */
  filterSection: { marginBottom: 16 },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  filterSectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  settingsShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  settingsShortcutText: { fontSize: 12, fontWeight: '700', color: '#4338ca' },
  filterScrollContent: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  filterPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  filterPillActive: { backgroundColor: '#eef2ff', borderWidth: 1.5, borderColor: PRIMARY },
  filterPillInactive: { backgroundColor: '#f8fafc', borderWidth: 1.2, borderColor: '#e2e8f0' },
  filterPillText: { fontSize: 13 },
  filterPillTextActive: { color: PRIMARY, fontWeight: '800' },
  filterPillTextInactive: { color: '#64748b', fontWeight: '600' },

  /* Loading / empty */
  loadingContainer: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13.5, color: '#64748b', fontWeight: '600' },
  emptyStateCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    marginTop: 30,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  emptyStateTitle: { fontSize: 18, fontWeight: '800', color: PRIMARY, textAlign: 'center', marginTop: 14, lineHeight: 28 },
  errorText: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 8 },
  emptyStateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 24,
    paddingVertical: 11,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  emptyStateBtnText: { fontSize: 13.5, fontWeight: '700', color: '#ffffff' },

  /* Table */
  tableScrollContent: { minWidth: '100%', flexGrow: 1 },
  tableCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tableInner: { width: '100%' },
  tableHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1.2,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  th: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  tableRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  colNo: { width: 48, justifyContent: 'center' },
  colName: { width: 220, paddingRight: 16, justifyContent: 'center' },
  colCategory: { width: 140, paddingRight: 14, justifyContent: 'center' },
  colPrice: { width: 95, paddingRight: 12, alignItems: 'flex-end', justifyContent: 'center' },
  colStock: { width: 125, paddingRight: 10, justifyContent: 'center', gap: 4 },
  colActions: { width: 165, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  noColCell: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb' },
  tdNo: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  tdName: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  tdCodeSub: { fontSize: 12, fontWeight: '600', color: '#64748b', marginTop: 2 },
  tdCategory: { fontSize: 14, fontWeight: '700', color: '#334155' },
  tdPrice: { fontSize: 14, fontWeight: '800', color: '#0f172a', textAlign: 'right' },
  tdMmkUnit: { fontSize: 10.5, fontWeight: '800', color: '#64748b', marginTop: 1, textAlign: 'right' },
  tdStock: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  statusOutBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusOutBadgeText: { fontSize: 11, fontWeight: '800', color: '#dc2626' },
  statusLowBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusLowBadgeText: { fontSize: 11, fontWeight: '800', color: '#b45309' },
  actionBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: { fontSize: 12.5, fontWeight: '700', color: '#ffffff' },

  /* Pagination */
  paginationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1.2,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  paginationSummaryText: { fontSize: 12.5, color: '#64748b', fontWeight: '500' },
  paginationBoldText: { fontWeight: '800', color: '#0f172a' },
  paginationControlsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  pageNavBtnDisabled: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', opacity: 0.6 },
  pageNavBtnText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  pageNavBtnTextDisabled: { color: '#94a3b8' },
  pageNumbersGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageNumberBtn: {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pageNumberBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  pageNumberBtnText: { fontSize: 12.5, fontWeight: '700', color: '#334155' },
  pageNumberBtnTextActive: { color: '#ffffff' },
  pageEllipsisText: { fontSize: 13, fontWeight: '700', color: '#94a3b8', paddingHorizontal: 4 },
});
