import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import CartButton from '../../features/pos/components/CartButton';
import CartSheet from '../../features/pos/components/CartSheet';
import PosFilters, { ALL_CATEGORIES } from '../../features/pos/components/PosFilters';
import PosNavbar from '../../features/pos/components/PosNavbar';
import ProductCard from '../../features/pos/components/ProductCard';
import WholesaleSheet from '../../features/pos/components/WholesaleSheet';
import {
  useCategories,
  useDebouncedValue,
  useProducts,
  useStorefront,
} from '../../features/pos/hooks/usePosData';
import { CART_ERROR_MESSAGES, CartError, filterProducts, StockFilter } from '../../features/pos/lib';
import { colors, TABLET_MIN_WIDTH, toBurmeseNumber } from '../../features/pos/theme';
import type { PosProduct } from '../../services/pos/types';
import { webBridge } from '../../services/webBridge';
import { useAuthStore } from '../../store/authStore';
import { useCartStore, useCartTotals } from '../../store/cartStore';
import { usePrinterStore } from '../../store/printerStore';
import { useShopStore } from '../../store/shopStore';
import { toast } from '../../store/toastStore';

const leavePos = () => {
  // Opened from a deep link there is nothing to go back to
  if (router.canGoBack()) router.back();
  else router.replace('/');
};

// Close the native screens and show this page of the web app underneath
const showWebPage = (path: string) => {
  webBridge.navigate(path);
  if (router.canDismiss()) router.dismissAll();
  else router.replace('/');
};

// The token is missing or was rejected (401), so send the user to the web login under this screen
const goToWebLogin = () => showWebPage('/login');

const confirmLogout = () => {
  Alert.alert('အကောင့်ထွက်မည်', 'အကောင့်မှ ထွက်မှာ သေချာပါသလား?', [
    { text: 'မလုပ်တော့ပါ', style: 'cancel' },
    {
      text: 'ထွက်မည်',
      style: 'destructive',
      onPress: () => {
        // The web page goes to /login by itself once it has logged out
        webBridge.logout();
        if (router.canDismiss()) router.dismissAll();
        else router.replace('/');
      },
    },
  ]);
};

const showError = (error: CartError | undefined) => {
  if (error) toast.error(CART_ERROR_MESSAGES[error]);
};

export default function PosScreen() {
  const token = useAuthStore((state) => state.token);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  if (!isHydrated) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <Text style={styles.loginText}>Login မဝင်ရသေးပါ။ Web app မှာ login အရင်ဝင်ပါ။</Text>
        <TouchableOpacity onPress={goToWebLogin} style={styles.loginButton}>
          <Text style={styles.loginButtonText}>Login ဝင်မယ်</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return <PosCatalog />;
}

function PosCatalog() {
  const { width } = useWindowDimensions();
  // One product per row on phones, two on tablets
  const columns = width >= TABLET_MIN_WIDTH ? 2 : 1;

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [stockFilter, setStockFilter] = useState<StockFilter>('All');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [wholesaleProduct, setWholesaleProduct] = useState<PosProduct | null>(null);

  const items = useCartStore((state) => state.items);
  const saleCount = useCartStore((state) => state.saleCount);
  const addProduct = useCartStore((state) => state.addProduct);
  const applyWholesaleTier = useCartStore((state) => state.applyWholesaleTier);
  const openCheckout = useCartStore((state) => state.openCheckout);
  const totals = useCartTotals();
  const connectedPrinter = usePrinterStore((state) => state.connectedPrinter);

  const debouncedSearch = useDebouncedValue(search.trim());
  const categories = useCategories();
  const { storefront, error: storefrontError } = useStorefront();
  const { products, totalItems, error, isLoading, isRefreshing, isLoadingMore, loadMore } = useProducts({
    storefrontId: storefront?._id,
    search: debouncedSearch,
    category,
    // Reload after a sale too, so stock levels are current
    reloadToken: `${refreshNonce}:${saleCount}`,
  });

  const visibleProducts = useMemo(() => filterProducts(products, stockFilter), [products, stockFilter]);
  const cartQtyById = useMemo(() => new Map(items.map((item) => [item.product._id, item.qty])), [items]);

  // Shop branding for receipts, fetched while the cashier picks products
  useEffect(() => {
    useShopStore.getState().loadSettings();
  }, []);

  const handleProductPress = useCallback((product: PosProduct) => showError(addProduct(product)), [addProduct]);
  const handleWholesalePress = useCallback((product: PosProduct) => setWholesaleProduct(product), []);
  const refresh = () => setRefreshNonce((n) => n + 1);

  const handleSelectTier = (product: PosProduct, tierQuantity: number) => {
    showError(applyWholesaleTier(product, tierQuantity));
    setWholesaleProduct(null);
  };

  const handleCheckout = () => {
    openCheckout();
    setIsCartOpen(false);
    router.push('/pos/checkout');
  };

  // Scrolls with the products, like the web page
  const listHeader = (
    <View style={styles.listHeader}>
      <View>
        <Text style={styles.pageTitle}>Voucher Checkout</Text>
        <Text style={styles.pageSubtitle}>Select products and check out voucher for the customer</Text>
      </View>
      <PosFilters
        search={search}
        onSearchChange={setSearch}
        categories={categories}
        category={category}
        onCategoryChange={setCategory}
        stockFilter={stockFilter}
        onStockFilterChange={setStockFilter}
        onRefresh={refresh}
        isRefreshing={isRefreshing}
      />
      <Text style={styles.countText}>
        ပစ္စည်း စုစုပေါင်း {toBurmeseNumber(Math.max(totalItems, visibleProducts.length))} ခုအနက်{' '}
        {toBurmeseNumber(visibleProducts.length)} ခု ပြထားပါတယ်
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <PosNavbar
        title="အရောင်း ဘောင်ချာထုတ်မယ်"
        subtitle={storefront ? `Checkout (POS) · ${storefront.locationName}` : 'Checkout (POS)'}
        onBack={leavePos}
        onPrinter={() => router.push('/printer')}
        printerConnected={!!connectedPrinter}
        onHome={() => showWebPage('/')}
        onLogout={confirmLogout}
      />

      <View style={styles.page}>
        <View style={styles.card}>
          <FlatList
            // numColumns can't change on a mounted FlatList
            key={`pos-grid-${columns}`}
            data={isLoading || storefrontError ? [] : visibleProducts}
            keyExtractor={(product) => product._id}
            numColumns={columns}
            // FlatList rejects a column wrapper style on single-column lists
            columnWrapperStyle={columns > 1 ? styles.column : undefined}
            contentContainerStyle={styles.grid}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListHeaderComponent={listHeader}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                cartQty={cartQtyById.get(item._id) ?? 0}
                columns={columns}
                onPress={handleProductPress}
                onWholesalePress={handleWholesalePress}
              />
            )}
            onEndReached={loadMore}
            onEndReachedThreshold={0.6}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} colors={[colors.primary]} />}
            ListEmptyComponent={
              storefrontError ? (
                <Text style={styles.empty}>{storefrontError}</Text>
              ) : isLoading ? (
                <ActivityIndicator style={styles.loading} size="large" color={colors.primary} />
              ) : (
                <Text style={styles.empty}>{error || 'ပစ္စည်း မရှိသေးပါ'}</Text>
              )
            }
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.footerLoaderText}>ပစ္စည်းများ ထပ်မံဖော်ပြနေပါသည်...</Text>
                </View>
              ) : null
            }
          />
        </View>
      </View>

      {items.length > 0 && (
        <SafeAreaView edges={['bottom']} style={styles.cartBar} pointerEvents="box-none">
          <CartButton itemCount={totals.itemCount} subtotal={totals.subtotal} onPress={() => setIsCartOpen(true)} />
        </SafeAreaView>
      )}

      {/* The cart closes by itself once it's emptied */}
      <CartSheet
        visible={isCartOpen && items.length > 0}
        onClose={() => setIsCartOpen(false)}
        onCheckout={handleCheckout}
      />
      <WholesaleSheet
        product={wholesaleProduct}
        onClose={() => setWholesaleProduct(null)}
        onSelectTier={handleSelectTier}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  loginText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger,
    textAlign: 'center',
  },
  loginButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  loginButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  // Grey page behind the white card, as on the web
  page: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  card: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  listHeader: {
    gap: 16,
    paddingBottom: 14,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12,
    color: colors.textFaint,
    marginTop: 4,
  },
  countText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  grid: {
    padding: 16,
    paddingBottom: 110,
    gap: 12,
  },
  column: {
    gap: 12,
  },
  loading: {
    marginVertical: 48,
  },
  empty: {
    textAlign: 'center',
    color: colors.textFaint,
    paddingVertical: 48,
  },
  footerLoader: {
    alignItems: 'center',
    gap: 6,
    marginVertical: 16,
  },
  footerLoaderText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cartBar: {
    position: 'absolute',
    left: 16,
    right: 20,
    bottom: 16,
  },
});
