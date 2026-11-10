// Lets native screens drive the WebView that stays mounted underneath them

interface WebViewHandle {
  injectJavaScript: (script: string) => void;
}

type WebViewGetter = () => WebViewHandle | null;

let getWebView: WebViewGetter | null = null;

export const webBridge = {
  attach(getter: WebViewGetter) {
    getWebView = getter;
  },

  detach(getter: WebViewGetter) {
    if (getWebView === getter) getWebView = null;
  },

  // Client-side navigation in the web app; react-router picks up the popstate
  navigate(path: string): boolean {
    const webView = getWebView?.();
    if (!webView) return false;
    webView.injectJavaScript(`
      (function() {
        window.history.pushState(null, '', ${JSON.stringify(path)});
        window.dispatchEvent(new PopStateEvent('popstate'));
      })();
      true;
    `);
    return true;
  },

  // Same as the web header's Logout: drop the token and admin, then show the login page.
  // Removing authToken also reaches the app as AUTH_LOGOUT, which clears the native token.
  logout(): boolean {
    const webView = getWebView?.();
    if (!webView) return false;
    webView.injectJavaScript(`
      (function() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('adminData');
        window.history.pushState(null, '', '/login');
        window.dispatchEvent(new PopStateEvent('popstate'));
      })();
      true;
    `);
    return true;
  },
};
