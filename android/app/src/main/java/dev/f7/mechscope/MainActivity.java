package dev.f7.mechscope;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.VideoView;
import android.window.OnBackInvokedCallback;

import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Offline renderer shell. The parent supplies the web UI; no network page is ever trusted. */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String ENTRY = ORIGIN + "/assets/web/index.html";
    private static final String STORE = "https://play.google.com/store/apps/details?id=dev.f7.mechscope";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ArrayDeque<JSONObject> pendingEvents = new ArrayDeque<>();
    private FrameLayout root;
    private FrameLayout webContainer;
    private FrameLayout splash;
    private LinearLayout bannerContainer;
    private WebView web;
    private VideoView video;
    private BillingController billing;
    private AdsController ads;
    private SharedPreferences preferences;
    private WebViewAssetLoader assetLoader;
    private boolean foreground;
    private boolean destroyed;
    private boolean splashFinished;
    private boolean videoPrepared;
    private boolean firstLaunch;
    private boolean documentLoaded;
    private boolean webReady;
    private boolean pageFailed;
    private int rendererRecoveries;
    private int videoPosition;
    private long lastBridgeUiAction;
    private String theme = "light";
    private OnBackInvokedCallback backCallback;
    private final Runnable splashTimeout = this::finishSplash;

    @Override protected void onCreate(Bundle savedInstanceState) {
        preferences = getSharedPreferences("settings", MODE_PRIVATE);
        theme = preferences.getString("theme", "light");
        setTheme(isDark() ? R.style.Theme_MechScope_Dark : R.style.Theme_MechScope);
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 31) getSplashScreen().setOnExitAnimationListener(view -> view.remove());
        firstLaunch = savedInstanceState != null ? savedInstanceState.getBoolean("firstLaunch", true)
                : !preferences.getBoolean("hasLaunched", false);
        preferences.edit().putBoolean("hasLaunched", true).apply();
        splashFinished = savedInstanceState != null && savedInstanceState.getBoolean("splashFinished", false);
        configureWindow();
        createLayout();
        applySystemBarAppearance();
        assetLoader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .setHttpAllowed(false)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(getApplicationContext())).build();
        billing = new BillingController(this);
        ads = new AdsController(this, bannerContainer, firstLaunch);
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = this::dispatchBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0, backCallback);
        }
        if (splashFinished) createWebView();
        else showMechScopeSplash();
    }

    @SuppressWarnings("deprecation")
    private void configureWindow() {
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }

    private void createLayout() {
        root = new FrameLayout(this);
        root.setBackgroundColor(backgroundColor());
        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        webContainer = new FrameLayout(this);
        column.addView(webContainer, new LinearLayout.LayoutParams(-1, 0, 1));
        bannerContainer = new LinearLayout(this);
        bannerContainer.setOrientation(LinearLayout.VERTICAL);
        bannerContainer.setGravity(Gravity.CENTER_HORIZONTAL);
        bannerContainer.setVisibility(View.GONE);
        column.addView(bannerContainer, new LinearLayout.LayoutParams(-1, -2));
        root.addView(column, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int left, top, right, bottom;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars()
                        | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime()
                        | WindowInsets.Type.mandatorySystemGestures());
                left = safe.left; top = safe.top; right = safe.right; bottom = safe.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft(); top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight(); bottom = insets.getSystemWindowInsetBottom();
                if (Build.VERSION.SDK_INT >= 28 && insets.getDisplayCutout() != null) {
                    left = Math.max(left, insets.getDisplayCutout().getSafeInsetLeft());
                    right = Math.max(right, insets.getDisplayCutout().getSafeInsetRight());
                    top = Math.max(top, insets.getDisplayCutout().getSafeInsetTop());
                    bottom = Math.max(bottom, insets.getDisplayCutout().getSafeInsetBottom());
                }
            }
            view.setPadding(left, top, right, bottom);
            // Native padding owns safe insets; WebView must not apply them a second time.
            if (Build.VERSION.SDK_INT >= 30) return WindowInsets.CONSUMED;
            if (Build.VERSION.SDK_INT >= 28) return insets.consumeSystemWindowInsets().consumeDisplayCutout();
            return insets.consumeSystemWindowInsets();
        });
        column.addOnLayoutChangeListener((v, l, t, r, b, oldL, oldT, oldR, oldB) -> {
            if (ads != null) bannerContainer.post(() -> { if (!destroyed) ads.sizeChanged(); });
        });
        root.requestApplyInsets();
    }

    private void showMechScopeSplash() {
        splash = new FrameLayout(this);
        splash.setBackgroundColor(Color.rgb(245, 247, 250));
        LinearLayout identity = new LinearLayout(this);
        identity.setGravity(Gravity.CENTER);
        identity.setOrientation(LinearLayout.VERTICAL);
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.ic_mechscope);
        logo.setContentDescription("MechScope metallic hexagon and optical lens");
        identity.addView(logo, new LinearLayout.LayoutParams(dp(164), dp(164)));
        TextView title = new TextView(this);
        title.setText(R.string.short_name);
        title.setTextColor(Color.rgb(24, 42, 57));
        title.setTextSize(28);
        title.setGravity(Gravity.CENTER);
        identity.addView(title);
        TextView subtitle = new TextView(this);
        subtitle.setText("HOW IT WORKS");
        subtitle.setTextColor(Color.rgb(72, 101, 119));
        subtitle.setTextSize(12);
        subtitle.setLetterSpacing(0.18f);
        subtitle.setPadding(0, dp(10), 0, 0);
        identity.addView(subtitle);
        splash.addView(identity, new FrameLayout.LayoutParams(-1, -1));
        root.addView(splash, new FrameLayout.LayoutParams(-1, -1));
        handler.postDelayed(this::showF7Splash, 650);
    }

    private void showF7Splash() {
        if (destroyed || splashFinished) return;
        if (!foreground) return; // onResume restarts this step; never play while backgrounded.
        splash.removeAllViews();
        splash.setBackgroundColor(Color.BLACK);
        video = new VideoView(this);
        video.setContentDescription("Official F7 Developer splash");
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER);
        splash.addView(video, params);
        video.setOnPreparedListener(player -> {
            videoPrepared = true;
            player.setVolume(0f, 0f);
            player.setLooping(false);
            if (foreground) {
                video.start();
                handler.removeCallbacks(splashTimeout);
                handler.postDelayed(splashTimeout, 12_000);
            }
        });
        video.setOnCompletionListener(player -> finishSplash());
        video.setOnErrorListener((player, what, extra) -> { finishSplash(); return true; });
        video.setVideoURI(Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.f7_splash));
        handler.postDelayed(splashTimeout, 12_000);
    }

    private void finishSplash() {
        if (destroyed || splashFinished) return;
        splashFinished = true;
        handler.removeCallbacks(splashTimeout);
        if (video != null) { video.stopPlayback(); video = null; }
        if (splash != null) { root.removeView(splash); splash = null; }
        createWebView();
        if (foreground) billing.resume();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        if (destroyed) return;
        documentLoaded = false;
        webReady = false;
        pageFailed = false;
        webContainer.removeAllViews();
        try {
            web = new WebView(this);
        } catch (RuntimeException unavailable) {
            web = null;
            showRendererError("Android System WebView is unavailable. Enable or update it, then reopen MechScope.", false);
            return;
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            web.destroy();
            web = null;
            showRendererError("Update Android System WebView or Chrome to use the secure offline renderer.", false);
            return;
        }
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        // Asset interception returns a response for EVERY request; denied URLs never fall through to the network.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setGeolocationEnabled(false);
        settings.setSafeBrowsingEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, false);
        }
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        // Even an existing service worker cannot fetch remote content or local files.
        ServiceWorkerController workers = ServiceWorkerController.getInstance();
        workers.getServiceWorkerWebSettings().setAllowFileAccess(false);
        workers.getServiceWorkerWebSettings().setAllowContentAccess(false);
        workers.setServiceWorkerClient(offlineWorkers(assetLoader));
        web.setBackgroundColor(backgroundColor());
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetResponse(assetLoader, request);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !trustedAsset(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !trustedAsset(Uri.parse(url));
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (view != web) return;
                documentLoaded = false;
                webReady = false;
                pageFailed = false;
                ads.suspendForDocument();
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (view != web || pageFailed || !trustedAsset(Uri.parse(url))) return;
                documentLoaded = true;
                sendState();
                flushEvents();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (view == web && request.isForMainFrame()) showRendererError("The offline renderer could not start. Retry or update Android System WebView.", true);
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (view == web && request.isForMainFrame()) showRendererError("The bundled offline page is missing. Install a complete MechScope build.", true);
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (view == web) {
                    web = null;
                    documentLoaded = false;
                    webReady = false;
                    ads.suspendForDocument();
                    webContainer.removeView(view);
                    view.destroy();
                    if (++rendererRecoveries <= 2) handler.post(MainActivity.this::createWebView);
                    else showRendererError("The 3D renderer stopped. Close other apps, then retry. Your saved settings are preserved.", true);
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, false, false);
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> result, FileChooserParams params) {
                result.onReceiveValue(null);
                return true;
            }
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean gesture, android.os.Message message) { return false; }
        });
        web.setDownloadListener((url, agent, disposition, mime, length) -> notice("Downloads and local file access are disabled in the offline renderer."));
        WebViewCompat.addWebMessageListener(web, "NativeBridge", Collections.singleton(ORIGIN),
                (view, message, sourceOrigin, mainFrame, replyProxy) -> {
                    if (!mainFrame || view != web || !trustedOrigin(sourceOrigin)
                            || view.getUrl() == null || !trustedAsset(Uri.parse(view.getUrl()))) return;
                    String data;
                    try { data = message.getData(); } catch (IllegalStateException ignored) { return; }
                    if (data == null || data.length() > 8192) return;
                    try { handleAction(new JSONObject(data)); }
                    catch (JSONException ignored) { notice("The native request was not valid JSON."); }
                });
        webContainer.addView(web, new FrameLayout.LayoutParams(-1, -1));
        web.loadUrl(ENTRY);
        if (!foreground) web.onPause();
    }

    private static boolean trustedOrigin(Uri uri) {
        return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())
                && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private static boolean trustedAsset(Uri uri) {
        if (!trustedOrigin(uri)) return false;
        String path = uri.getPath();
        if (path == null || !path.startsWith("/assets/web/") || path.contains("\\") || path.indexOf('\0') >= 0) return false;
        for (String segment : path.split("/")) if (segment.equals("..") || segment.equals(".")) return false;
        // No double-encoded separators/traversal. Queries and fragments do not change the local asset.
        return !path.contains("%");
    }

    private static ServiceWorkerClient offlineWorkers(WebViewAssetLoader loader) {
        // Process-wide service-worker client retains only application assets, never an Activity.
        return new ServiceWorkerClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                return assetResponse(loader, request);
            }
        };
    }

    private static WebResourceResponse assetResponse(WebViewAssetLoader loader, WebResourceRequest request) {
        if (!"GET".equals(request.getMethod()) || !trustedAsset(request.getUrl())) return blocked(403, "Blocked");
        WebResourceResponse response = loader.shouldInterceptRequest(request.getUrl());
        if (response == null || response.getData() == null) return blocked(404, "Not Found");
        Map<String, String> headers = new HashMap<>();
        if (response.getResponseHeaders() != null) headers.putAll(response.getResponseHeaders());
        headers.put("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; "
                + "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; "
                + "worker-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'");
        headers.put("X-Content-Type-Options", "nosniff");
        headers.put("Referrer-Policy", "no-referrer");
        headers.put("Cache-Control", "no-store");
        response.setResponseHeaders(headers);
        return response;
    }

    private static WebResourceResponse blocked(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason, Collections.emptyMap(),
                new ByteArrayInputStream(reason.getBytes(StandardCharsets.UTF_8)));
    }

    private void handleAction(JSONObject message) {
        if (destroyed || !splashFinished) return;
        String action = message.optString("action", "");
        if ("ready".equals(action)) {
            documentLoaded = true;
            webReady = true; // Parent sends only after splash/onboarding are finished, never at first paint.
            sendState();
            flushEvents();
            ads.ready();
            return;
        }
        if ("theme".equals(action)) { changeTheme(message.optString("value", "")); return; }
        if ("back".equals(action)) { dispatchBack(); return; }
        if ("exit".equals(action)) { if (!ads.busy()) finish(); return; }
        if (!foreground || ads.busy()) return;
        long now = android.os.SystemClock.elapsedRealtime();
        if (now - lastBridgeUiAction < 700) return;
        lastBridgeUiAction = now;
        switch (action) {
            case "share": share(); break;
            case "rate": openHttps(STORE); break;
            case "purchase": if (webReady) billing.purchase(); break;
            case "restore": billing.restore(true); break;
            case "rewarded": if (webReady) ads.rewarded(message.optString("requestId", "optional-bonus").substring(0,
                    Math.min(128, message.optString("requestId", "optional-bonus").length()))); break;
            case "library": if (webReady) ads.library(); break;
            case "privacy": privacyPolicy(); break;
            case "consent": if (webReady) ads.privacyChoices(); break;
            case "openExternal": openHttps(message.optString("url", "")); break;
            case "settings": showSettings(); break;
            case "about": showAbout(); break;
            default: notice("Unsupported native action.");
        }
    }

    private void share() {
        Intent share = new Intent(Intent.ACTION_SEND).setType("text/plain")
                .putExtra(Intent.EXTRA_SUBJECT, getString(R.string.app_name))
                .putExtra(Intent.EXTRA_TEXT, "Explore how machines work in MechScope 3D: How It Works.\n" + STORE);
        try { startActivity(Intent.createChooser(share, "Share MechScope 3D")); }
        catch (ActivityNotFoundException ignored) { notice("No sharing app is available."); }
    }

    private void openHttps(String value) {
        try {
            if (value.length() > 2048 || value.matches("(?s).*\\s.*")) throw new IllegalArgumentException();
            URI parsed = new URI(value);
            String host = parsed.getHost();
            if (!"https".equals(parsed.getScheme()) || parsed.getRawUserInfo() != null
                    || (parsed.getPort() != -1 && parsed.getPort() != 443) || host == null) throw new IllegalArgumentException();
            host = host.toLowerCase(Locale.ROOT);
            if (!host.matches("(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}")
                    || host.endsWith(".local") || host.endsWith(".localhost") || host.equals("appassets.androidplatform.net")) {
                throw new IllegalArgumentException();
            }
            Intent browser = new Intent(Intent.ACTION_VIEW, Uri.parse(parsed.toASCIIString()));
            browser.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(browser); // External browser, never the privileged WebView; no intent:// handling.
        } catch (ActivityNotFoundException ignored) { notice("No browser is available to open this HTTPS link."); }
        catch (Exception ignored) { notice("Only valid public HTTPS links may be opened."); }
    }

    private void privacyPolicy() {
        if (!BuildConfig.PRIVACY_POLICY_URL.isEmpty()) { openHttps(BuildConfig.PRIVACY_POLICY_URL); return; }
        new AlertDialog.Builder(this).setTitle("Privacy · QA build")
                .setMessage("The 3D library runs locally. If consent allows, Google Mobile Ads and UMP use network services for ads and privacy choices. "
                        + "Google Play handles payments; this app stores a signed purchase receipt privately to remember Remove Ads offline. "
                        + "No camera, microphone, location or shared-storage access is requested.\n\n"
                        + "This non-production build has no published developer privacy-policy URL. Production is blocked until it is configured. "
                        + "Privacy choices are available in Settings when UMP requires them.")
                .setPositiveButton("Close", null).show();
    }

    private void showSettings() {
        String purchaseLabel = adsRemoved() ? "Remove Ads · active" : "Remove Ads" + (billing.price().isEmpty() ? " · unavailable" : " · " + billing.price());
        new AlertDialog.Builder(this).setTitle("Settings")
                .setItems(new String[]{"Appearance", purchaseLabel, "Restore purchases", "Privacy policy", "Privacy choices", "Share", "Rate on Google Play", "About"},
                        (dialog, item) -> {
                            switch (item) {
                                case 0: showAppearance(); break;
                                case 1: if (webReady) billing.purchase(); else notice("Complete onboarding first."); break;
                                case 2: billing.restore(true); break;
                                case 3: privacyPolicy(); break;
                                case 4: if (webReady) ads.privacyChoices(); else notice("Complete onboarding first."); break;
                                case 5: share(); break;
                                case 6: openHttps(STORE); break;
                                case 7: showAbout(); break;
                                default: break;
                            }
                        }).setNegativeButton("Close", null).show();
    }

    private void showAppearance() {
        String[] values = {"light", "dark", "system"};
        int checked = "dark".equals(theme) ? 1 : "system".equals(theme) ? 2 : 0;
        new AlertDialog.Builder(this).setTitle("Appearance")
                .setSingleChoiceItems(new String[]{"Light (default)", "Dark", "Use system setting"}, checked,
                        (dialog, which) -> { changeTheme(values[which]); dialog.dismiss(); })
                .setNegativeButton("Cancel", null).show();
    }

    private void showAbout() {
        new AlertDialog.Builder(this).setTitle(R.string.app_name)
                .setMessage("By F7 Developer\nVersion " + BuildConfig.VERSION_NAME + "\nEnglish · Offline 3D library\n\n"
                        + (BuildConfig.PRODUCTION ? "Google Play handles optional Remove Ads purchases.\n\n"
                        : "NON-PRODUCTION QA: Google test ads. Purchases require real Play configuration and distribution; none are simulated.\n\n")
                        + "Offline ownership uses a locally verified, signed receipt. It cannot detect refunds or a changed Play account until reconnection. "
                        + "Client signature verification is not a substitute for a secure purchase-verification backend. Reinstalling requires an online restore.\n\n"
                        + "Remove Ads is a one-time purchase; the USD 4.99 base price is configured in Play Console. Your actual localized price appears in checkout.")
                .setPositiveButton("Close", null).show();
    }

    private void showRendererError(String message, boolean retry) {
        if (destroyed) return;
        pageFailed = true;
        documentLoaded = false;
        webReady = false;
        if (ads != null) ads.suspendForDocument();
        LinearLayout error = new LinearLayout(this);
        error.setOrientation(LinearLayout.VERTICAL);
        error.setGravity(Gravity.CENTER);
        error.setPadding(dp(24), dp(24), dp(24), dp(24));
        error.setBackgroundColor(backgroundColor());
        TextView text = new TextView(this);
        text.setText(message);
        text.setTextColor(primaryTextColor());
        text.setTextSize(17);
        text.setGravity(Gravity.CENTER);
        error.addView(text, new LinearLayout.LayoutParams(-1, -2));
        if (retry) {
            Button button = new Button(this);
            button.setText("Retry offline renderer");
            button.setOnClickListener(v -> { destroyWebView(); createWebView(); });
            error.addView(button);
        }
        Button close = new Button(this);
        close.setText("Close app");
        close.setOnClickListener(v -> finish());
        error.addView(close);
        webContainer.addView(error, new FrameLayout.LayoutParams(-1, -1));
    }

    private void changeTheme(String value) {
        if (!value.equals("light") && !value.equals("dark") && !value.equals("system")) return;
        theme = value;
        preferences.edit().putString("theme", value).apply();
        setTheme(isDark() ? R.style.Theme_MechScope_Dark : R.style.Theme_MechScope);
        root.setBackgroundColor(backgroundColor());
        if (web != null) web.setBackgroundColor(backgroundColor());
        applySystemBarAppearance();
        sendState(); // Parent applies detail.theme; native never edits the web DOM.
    }

    private boolean isDark() {
        return "dark".equals(theme) || ("system".equals(theme)
                && (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
    }
    private int backgroundColor() { return isDark() ? Color.rgb(16, 24, 32) : Color.rgb(245, 247, 250); }
    private int primaryTextColor() { return isDark() ? Color.rgb(237, 244, 250) : Color.rgb(24, 42, 57); }
    int secondaryTextColor() { return isDark() ? Color.rgb(177, 194, 208) : Color.rgb(78, 100, 117); }
    int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    boolean isForeground() { return foreground && !destroyed && !isFinishing(); }
    boolean adsRemoved() { return billing != null && billing.adsRemoved(); }
    boolean canPresentNativeUi() { return isForeground() && splashFinished && webReady && (ads == null || !ads.busy()); }

    @SuppressWarnings("deprecation")
    private void applySystemBarAppearance() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(isDark() ? 0 : mask, mask);
            }
        } else {
            int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            if (!isDark()) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }
    }

    static JSONObject event(String type, Object... pairs) {
        JSONObject object = new JSONObject();
        try {
            object.put("type", type);
            for (int i = 0; i + 1 < pairs.length; i += 2) object.put((String) pairs[i], pairs[i + 1]);
        } catch (JSONException impossible) { throw new IllegalArgumentException(impossible); }
        return object;
    }

    void sendState() {
        if (!documentLoaded || billing == null) return;
        emit(event("state", "native", true, "adsRemoved", billing.adsRemoved(),
                "billingAvailable", billing.available(), "price", billing.price(), "adMode", BuildConfig.AD_MODE,
                "version", BuildConfig.VERSION_NAME, "theme", theme, "resolvedTheme", isDark() ? "dark" : "light",
                "privacyOptionsRequired", ads != null && ads.privacyOptionsRequired(),
                "entitlementSource", billing.adsRemoved() ? (billing.cachedOnly() ? "cached-signed-receipt" : "play-signed-receipt") : "none",
                "entitlementLimitation", "Offline receipts cannot detect refunds or Play account changes until reconnection.",
                "production", BuildConfig.PRODUCTION));
    }

    void onBillingStateChanged() { if (ads != null) ads.entitlementChanged(); sendState(); }

    void notice(String message) {
        emit(event("notice", "message", message));
        if (isForeground() && splashFinished) Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    void emit(JSONObject object) {
        if (destroyed) return;
        if (web == null || !documentLoaded) {
            if (pendingEvents.size() >= 32) pendingEvents.removeFirst();
            pendingEvents.addLast(object);
            return;
        }
        String json = JSONObject.quote(object.toString()).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029");
        web.evaluateJavascript("window.dispatchEvent(new CustomEvent('mechscope:native',{detail:JSON.parse(" + json + ")}));", null);
    }

    private void flushEvents() { while (web != null && documentLoaded && !pendingEvents.isEmpty()) emit(pendingEvents.removeFirst()); }

    private void dispatchBack() {
        if (!splashFinished || (ads != null && ads.busy())) return;
        emit(event("back")); // The web UI decides whether to navigate or send action: exit.
    }

    @Override public void onBackPressed() { dispatchBack(); }

    @Override protected void onResume() {
        super.onResume();
        foreground = true;
        applySystemBarAppearance();
        if (!splashFinished) {
            if (video != null && videoPrepared) {
                video.seekTo(videoPosition);
                video.start();
                handler.postDelayed(splashTimeout, 12_000);
            } else if (video == null && splash != null) handler.postDelayed(() -> { if (video == null) showF7Splash(); }, 650);
        }
        if (web != null) {
            web.setVisibility(View.VISIBLE);
            web.onResume();
            if (documentLoaded) emit(event("lifecycle", "state", "resume"));
        }
        if (billing != null && splashFinished) billing.resume();
        if (ads != null) ads.resume();
    }

    @Override protected void onPause() {
        foreground = false;
        handler.removeCallbacks(splashTimeout);
        if (video != null && videoPrepared) { videoPosition = video.getCurrentPosition(); video.pause(); }
        if (web != null) {
            if (documentLoaded) emit(event("lifecycle", "state", "pause"));
            web.onPause();
            web.setVisibility(View.INVISIBLE);
            // Do not call global pauseTimers(): it would also pause the ad SDK's WebViews.
        }
        if (ads != null) ads.pause();
        super.onPause();
    }

    @Override public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        changeTheme(theme);
        root.requestApplyInsets();
        bannerContainer.post(() -> { if (!destroyed) ads.sizeChanged(); });
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        state.putBoolean("splashFinished", splashFinished);
        state.putBoolean("firstLaunch", firstLaunch);
        super.onSaveInstanceState(state);
    }

    private void destroyWebView() {
        if (web == null) return;
        WebView previous = web;
        web = null;
        documentLoaded = false;
        webReady = false;
        webContainer.removeView(previous);
        previous.stopLoading();
        previous.destroy();
    }

    @Override protected void onDestroy() {
        destroyed = true;
        handler.removeCallbacksAndMessages(null);
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null) getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
        if (video != null) video.stopPlayback();
        if (ads != null) ads.close();
        if (billing != null) billing.close();
        destroyWebView();
        super.onDestroy();
    }
}
