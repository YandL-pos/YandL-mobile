import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';
import { router, useFocusEffect } from 'expo-router';

import { printerService } from '../services/printerService';
import { webBridge } from '../services/webBridge';
import { usePrinterStore } from '../store/printerStore';
import { useAuthStore } from '../store/authStore';
import { useShopStore } from '../store/shopStore';
import { dialog } from '../store/dialogStore';
import { toast } from '../store/toastStore';
import { printWebVoucher } from '../features/pos/printWebVoucher';
import { NATIVE_POS_ENABLED, WEB_APP_URL } from '../config';

const INJECTED_JAVASCRIPT = `
  window.isCommercialMobileApp = true;
  (function() {
    function syncAuthToken() {
      try {
        var token = localStorage.getItem('authToken');
        if (token && window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'AUTH_TOKEN_SYNC',
            token: token
          }));
        }
      } catch (e) {}
    }

    // Cashier name and receipt branding slot, for receipts printed by the native POS,
    // and the storefront picked on the web POS, which the native POS sells from too
    function syncWebPrefs() {
      try {
        if (!window.ReactNativeWebView) return;
        var admin = JSON.parse(localStorage.getItem('adminData') || '{}') || {};
        var slot = parseInt(localStorage.getItem('voucherReceiptLogoSlot') || '1', 10);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'WEB_PREFS_SYNC',
          cashierName: admin.name || admin.username || null,
          receiptSlot: isNaN(slot) ? 1 : slot,
          storefrontId: localStorage.getItem('pos_selected_storefront_id') || null
        }));
      } catch (e) {}
    }

    // 1. Initial check on page load
    syncAuthToken();
    syncWebPrefs();

    // 2. Intercept localStorage.setItem when login happens
    var origSetItem = localStorage.setItem;
    localStorage.setItem = function(k, v) {
      origSetItem.apply(this, arguments);
      if (k === 'authToken') {
        syncAuthToken();
      }
      if (k === 'adminData' || k === 'voucherReceiptLogoSlot' || k === 'pos_selected_storefront_id') {
        syncWebPrefs();
      }
    };

    // 3. Intercept localStorage.removeItem when logout happens
    var origRemoveItem = localStorage.removeItem;
    localStorage.removeItem = function(k) {
      origRemoveItem.apply(this, arguments);
      if (k === 'authToken' && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'AUTH_LOGOUT'
        }));
      }
    };

    // 4. Hand the new-sale route (/pos) to the native POS screen
    if (${NATIVE_POS_ENABLED} && !window.__commercialPosHooked) {
      window.__commercialPosHooked = true;
      var lastPath = null;

      function checkRoute(pushed) {
        var path = location.pathname.replace(/\\/+$/, '') || '/';
        if (path === '/pos' && window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'OPEN_NATIVE_POS'
          }));
          // Leave the web POS so it isn't sitting underneath when the native screen closes.
          // Only a pushed /pos entry can be undone with back(); otherwise overwrite it.
          if (pushed && lastPath) {
            history.back();
          } else {
            history.replaceState(null, '', lastPath || '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
          return;
        }
        lastPath = path;
      }

      // react-router navigates with pushState/replaceState, which fire no event of their own
      ['pushState', 'replaceState'].forEach(function(name) {
        var orig = history[name];
        history[name] = function() {
          var result = orig.apply(this, arguments);
          setTimeout(function() { checkRoute(name === 'pushState'); }, 0);
          return result;
        };
      });
      window.addEventListener('popstate', function() {
        setTimeout(function() { checkRoute(false); }, 0);
      });
      checkRoute(false);
    }
  })();
  true;
`;

export default function WebShell() {
  const webViewRef = useRef<any>(null);
  const isFocusedRef = useRef(false);
  // One web voucher print at a time, so a double tap doesn't print twice
  const printingVoucherRef = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasError, setHasError] = useState(false);


  // Let native screens navigate the web app
  useEffect(() => {
    const getWebView = () => webViewRef.current;
    webBridge.attach(getWebView);
    return () => webBridge.detach(getWebView);
  }, []);

  // Android hardware back handler; only while this screen is on top, so native screens get their own back
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      if (Platform.OS !== 'android') {
        return () => {
          isFocusedRef.current = false;
        };
      }

      const onBackPress = () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );

      return () => {
        isFocusedRef.current = false;
        subscription.remove();
      };
    }, [canGoBack]),
  );

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      setCanGoBack(navState.canGoBack);
    },
    [],
  );

  const handleRetry = useCallback(() => {
    setHasError(false);
    webViewRef.current?.reload();
  }, []);

  // External links → system browser
  const handleShouldStartLoad = useCallback((event: { url: string }) => {
    const { url } = event;
    if (url.startsWith(WEB_APP_URL) || url.startsWith('about:')) {
      return true;
    }
    Linking.openURL(url).catch(() => {});
    return false;
  }, []);

  // WebView message bridge: Handle print requests and settings modal triggers
  const handleWebViewMessage = useCallback(async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (!message || !message.type) return;

      switch (message.type) {
        case 'PRINT_RECEIPT': {
          const receiptData = message.data;
          try {
            await printerService.printReceipt(receiptData);
            webViewRef.current?.postMessage(
              JSON.stringify({
                type: 'PRINT_RESULT',
                success: true,
                invoiceNo: receiptData?.invoiceNo,
              })
            );
          } catch (printErr: any) {
            dialog.alert(
              'ပုံနှိပ်၍ မရပါ (Print Error)',
              printErr?.message || 'ပရင်တာချိတ်ဆက်မှုကို စစ်ဆေးပါ။'
            );
            webViewRef.current?.postMessage(
              JSON.stringify({
                type: 'PRINT_RESULT',
                success: false,
                error: printErr?.message || 'Print failed',
                invoiceNo: receiptData?.invoiceNo,
              })
            );
          }
          break;
        }

        // Order details' Print button: the web page can't print inside the WebView, so the app prints
        // the voucher on its Bluetooth printer, laid out like a native POS receipt
        case 'PRINT_VOUCHER': {
          if (!message.voucher || printingVoucherRef.current) break;
          printingVoucherRef.current = true;
          toast.info('ဘောင်ချာ ပုံနှိပ်နေပါသည်...');
          try {
            await printWebVoucher(message.voucher, {
              paymentType: message.paymentType,
              paymentMethod: message.paymentMethod,
            });
            toast.success('ပုံနှိပ်ပြီးပါပြီ');
          } catch (printErr: any) {
            if (!usePrinterStore.getState().connectedPrinter) {
              dialog.confirm({
                title: 'ပရင်တာ မချိတ်ရသေးပါ',
                message: 'ဘောင်ချာ ထုတ်ရန် Bluetooth ပရင်တာကို အရင်ချိတ်ပါ။',
                confirmText: 'ပရင်တာ ချိတ်မယ်',
                onConfirm: () => router.push('/printer'),
              });
            } else {
              dialog.alert('ပုံနှိပ်၍ မရပါ (Print Error)', printErr?.message || 'ပရင်တာချိတ်ဆက်မှုကို စစ်ဆေးပါ။');
            }
          } finally {
            printingVoucherRef.current = false;
          }
          break;
        }

        case 'OPEN_NATIVE_POS': {
          // Ignore repeats while the native POS is already open
          if (isFocusedRef.current) {
            router.push('/pos');
          }
          break;
        }

        case 'OPEN_PRINTER_SETTINGS': {
          if (isFocusedRef.current) router.push('/printer');
          break;
        }

        case 'GET_PRINTER_STATUS': {
          const state = usePrinterStore.getState();
          webViewRef.current?.postMessage(
            JSON.stringify({
              type: 'PRINTER_STATUS',
              connected: !!state.connectedPrinter,
              printer: state.connectedPrinter,
              paperWidth: state.paperWidth,
            })
          );
          break;
        }

        case 'AUTH_TOKEN_SYNC': {
          if (message.token) {
            useAuthStore.getState().setToken(message.token);
          }
          break;
        }

        case 'AUTH_LOGOUT': {
          useAuthStore.getState().logout();
          break;
        }

        case 'WEB_PREFS_SYNC': {
          useAuthStore.getState().setUserName(message.cashierName || null);
          if (typeof message.receiptSlot === 'number') {
            useShopStore.getState().setReceiptSlot(message.receiptSlot);
          }
          useShopStore
            .getState()
            .setPreferredStorefrontId(typeof message.storefrontId === 'string' ? message.storefrontId : null);
          break;
        }

        default:
          break;
      }
    } catch {
      // Ignore non-JSON messages
    }
  }, []);

  // Initial full-screen spinner
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#1e1b4b" />
    </View>
  );

  if (hasError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>📡</Text>
          <Text style={styles.errorTitle}>ချိတ်ဆက်မှု မအောင်မြင်ပါ</Text>
          <Text style={styles.errorMessage}>
            အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ထပ်မံကြိုးစားပါ။
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>ပြန်လည်ကြိုးစားမည် (Retry)</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_APP_URL }}
        style={styles.webView}

        // Core JS & Storage
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}

        // Injected client flag
        injectedJavaScript={INJECTED_JAVASCRIPT}

        // Message bridge
        onMessage={handleWebViewMessage}

        // Caching & Performance
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"

        // Security & Compatibility
        mixedContentMode="compatibility"
        allowFileAccess={true}
        originWhitelist={['https://*', 'http://*']}
        setSupportMultipleWindows={false}

        // UX & Navigation
        pullToRefreshEnabled={true}
        allowsBackForwardNavigationGestures={true}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}

        // Error handling
        onError={() => setHasError(true)}
        startInLoadingState={true}
        renderLoading={renderLoading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
  },
  errorIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  retryButton: {
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: '#1e1b4b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
