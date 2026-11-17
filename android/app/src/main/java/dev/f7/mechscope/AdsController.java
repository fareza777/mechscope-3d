package dev.f7.mechscope;

import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

/** Ads never live in or cover the WebView. UMP is a prerequisite for every format. */
final class AdsController {
    private static final long INTERVAL_MS = 180_000;
    private static final long AD_MAX_AGE_MS = 3_600_000;
    private static final long AD_BREAK_MS = 900_000;
    private final MainActivity host;
    private final LinearLayout container;
    private final SharedPreferences preferences;
    private final ConsentInformation consent;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final boolean firstLaunch;
    private boolean ready;
    private boolean consentUpdated;
    private boolean consentAttempted;
    private long nextConsentAttempt;
    private boolean consentBusy;
    private boolean initializing;
    private boolean initialized;
    private boolean closed;
    private boolean fullScreen;
    private boolean rewardLoading;
    private boolean rewardPrompt;
    private boolean interstitialLoading;
    private int generation;
    private int rewardTicket;
    private int bannerWidth;
    private long readyAt;
    private long lastInterstitialAt = -INTERVAL_MS;
    private long interstitialLoadedAt;
    private long interstitialRequestedAt = -60_000;
    private long bannerRequestedAt = -60_000;
    private long adBreakUntil;
    private AdView banner;
    private InterstitialAd interstitial;

    AdsController(MainActivity host, LinearLayout container, boolean firstLaunch) {
        this.host = host;
        this.container = container;
        this.firstLaunch = firstLaunch;
        preferences = host.getSharedPreferences("ad_frequency", 0);
        consent = UserMessagingPlatform.getConsentInformation(host);
    }

    boolean busy() { return fullScreen || consentBusy || rewardPrompt || rewardLoading; }
    boolean privacyOptionsRequired() {
        return consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }

    void ready() {
        if (!ready) { ready = true; readyAt = SystemClock.elapsedRealtime(); }
        resume();
    }

    // Used while recovering a crashed renderer: a new document must opt in with ready again.
    void suspendForDocument() { ready = false; invalidateAds(); }

    void resume() {
        if (closed || !ready || !host.isForeground()) return;
        if (!consentUpdated && !consentBusy && SystemClock.elapsedRealtime() >= nextConsentAttempt) updateConsent(false);
        else if (!consentBusy) activate();
        if (banner != null) banner.resume();
    }

    private void updateConsent(boolean explicit) {
        if (closed || consentBusy || fullScreen || !ready || !host.isForeground()) return;
        consentBusy = true;
        consentAttempted = true;
        invalidateAds();
        int ticket = generation;
        consent.requestConsentInfoUpdate(host, new ConsentRequestParameters.Builder().build(), () -> ui(() -> {
            if (!ready || !host.isForeground() || ticket != generation) { consentBusy = false; consentUpdated = false; return; }
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(host, error -> ui(() -> {
                consentBusy = false;
                consentUpdated = error == null;
                nextConsentAttempt = error == null ? 0 : SystemClock.elapsedRealtime() + 30_000;
                if (error != null && explicit) host.notice("Privacy choices could not load. Please try again online.");
                host.sendState();
                activate();
            }));
        }), error -> ui(() -> {
            consentBusy = false;
            consentUpdated = false;
            nextConsentAttempt = SystemClock.elapsedRealtime() + 30_000;
            if (explicit) host.notice("Consent service is unavailable. Ads stay off unless UMP has valid previous consent.");
            host.sendState();
            activate();
        }));
    }

    void privacyChoices() {
        if (!ready || !host.isForeground() || busy()) return;
        if (!privacyOptionsRequired()) {
            if (!consentUpdated || consent.getConsentStatus() == ConsentInformation.ConsentStatus.UNKNOWN) updateConsent(true);
            else host.notice("UMP does not require a privacy choices form in your current region. The privacy policy is available in Settings.");
            return;
        }
        consentBusy = true;
        invalidateAds();
        UserMessagingPlatform.showPrivacyOptionsForm(host, error -> ui(() -> {
            consentBusy = false;
            if (error != null) host.notice("Privacy choices are temporarily unavailable. Please try again.");
            host.sendState();
            activate();
        }));
    }

    private boolean eligible() {
        return !closed && ready && consentAttempted && !consentBusy && consent.canRequestAds()
                && !host.adsRemoved() && host.isForeground() && SystemClock.elapsedRealtime() >= adBreakUntil;
    }

    private void activate() {
        if (!eligible()) { if (host.adsRemoved() || !consent.canRequestAds()) invalidateAds(); return; }
        if (!initialized) {
            if (initializing) return;
            initializing = true;
            MobileAds.initialize(host, status -> ui(() -> {
                initializing = false;
                initialized = true;
                activate();
            }));
            return;
        }
        if (fullScreen || rewardLoading || rewardPrompt) return;
        ensureBanner();
        preloadInterstitial();
    }

    void entitlementChanged() {
        if (host.adsRemoved()) invalidateAds();
        else activate();
    }

    void sizeChanged() {
        if (banner != null && currentWidth() != bannerWidth) {
            destroyBanner();
            bannerRequestedAt = -60_000;
        }
        if (eligible() && initialized && !fullScreen) ensureBanner();
    }

    private int currentWidth() {
        // A GONE banner has no width yet. Its already-inset parent defines the available space.
        View parent = (View) container.getParent();
        int pixels = parent.getWidth() - parent.getPaddingLeft() - parent.getPaddingRight()
                - container.getPaddingLeft() - container.getPaddingRight();
        return Math.max(0, (int) (pixels / host.getResources().getDisplayMetrics().density));
    }

    private void ensureBanner() {
        int width = currentWidth();
        if (width < 200 || banner != null || SystemClock.elapsedRealtime() - bannerRequestedAt < 60_000) return;
        bannerRequestedAt = SystemClock.elapsedRealtime();
        bannerWidth = width;
        int ticket = generation;
        AdView view = new AdView(host);
        banner = view;
        view.setAdUnitId(BuildConfig.BANNER_ID);
        AdSize size = AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(host, width);
        view.setAdSize(size);
        TextView label = new TextView(host);
        label.setText(BuildConfig.PRODUCTION ? "Advertisement" : "Advertisement · Test ad");
        label.setTextSize(12);
        label.setTextColor(host.secondaryTextColor());
        label.setGravity(Gravity.CENTER);
        label.setPadding(0, host.dp(4), 0, host.dp(2));
        container.removeAllViews();
        container.addView(label, new LinearLayout.LayoutParams(-1, -2));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(size.getWidthInPixels(host), size.getHeightInPixels(host));
        params.gravity = Gravity.CENTER_HORIZONTAL;
        container.addView(view, params);
        container.setVisibility(View.GONE);
        view.setAdListener(new AdListener() {
            @Override public void onAdLoaded() {
                if (ticket != generation || !eligible()) {
                    if (banner == view) destroyBanner();
                } else if (banner == view) {
                    container.setVisibility(View.VISIBLE);
                }
            }
            @Override public void onAdFailedToLoad(LoadAdError error) {
                if (banner == view) destroyBanner();
            }
        });
        view.loadAd(new AdRequest.Builder().build());
    }

    private void preloadInterstitial() {
        long now = SystemClock.elapsedRealtime();
        if (firstLaunch || !eligible() || !initialized || interstitialLoading) return;
        if (interstitial != null && now - interstitialLoadedAt < AD_MAX_AGE_MS) return;
        if (now - interstitialRequestedAt < 60_000) return;
        interstitial = null;
        interstitialLoading = true;
        interstitialRequestedAt = now;
        int ticket = generation;
        InterstitialAd.load(host, BuildConfig.INTERSTITIAL_ID, new AdRequest.Builder().build(), new InterstitialAdLoadCallback() {
            @Override public void onAdLoaded(InterstitialAd ad) {
                if (closed || ticket != generation) return;
                interstitialLoading = false;
                if (eligible()) { interstitial = ad; interstitialLoadedAt = SystemClock.elapsedRealtime(); }
            }
            @Override public void onAdFailedToLoad(LoadAdError error) {
                if (ticket == generation) interstitialLoading = false;
            }
        });
    }

    void library() {
        long now = SystemClock.elapsedRealtime();
        long wallNow = System.currentTimeMillis();
        long last = preferences.getLong("last_interstitial", 0);
        if (!eligible() || busy() || firstLaunch || interstitial == null
                || now - readyAt < INTERVAL_MS || now - lastInterstitialAt < INTERVAL_MS || wallNow - last < INTERVAL_MS
                || now - interstitialLoadedAt >= AD_MAX_AGE_MS) {
            host.emit(MainActivity.event("library", "phase", "continue"));
            activate();
            return;
        }
        // Reserve before showing, so rotation/reentrancy or failed display cannot cause a burst.
        preferences.edit().putLong("last_interstitial", wallNow).apply();
        lastInterstitialAt = now;
        InterstitialAd ad = interstitial;
        interstitial = null;
        fullScreen = true;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            private void finished() {
                fullScreen = false;
                if (closed) return;
                host.emit(MainActivity.event("library", "phase", "continue"));
                activate();
            }
            @Override public void onAdDismissedFullScreenContent() { finished(); }
            @Override public void onAdFailedToShowFullScreenContent(AdError error) { finished(); }
        });
        ad.show(host);
    }

    void rewarded(String requestId) {
        if (host.adsRemoved()) { host.notice("Remove Ads is active; no ad will be shown."); return; }
        if (SystemClock.elapsedRealtime() < adBreakUntil) { host.notice("Your ad break is still active. All settings remain free."); return; }
        if (!eligible() || !initialized || busy()) {
            host.notice("A reward ad is not available right now. Nothing has been unlocked or charged.");
            return;
        }
        rewardPrompt = true;
        new AlertDialog.Builder(host)
                .setTitle("Optional reward ad")
                .setMessage("Complete this optional ad for a 15-minute ad break in this session. All models, settings and High quality remain free whether you watch or cancel."
                        + (BuildConfig.PRODUCTION ? "" : "\n\nQA uses a Google test ad, not production advertising."))
                .setNegativeButton("Not now", (dialog, which) -> rewardPrompt = false)
                .setOnCancelListener(dialog -> rewardPrompt = false)
                .setPositiveButton("Watch ad", (dialog, which) -> { rewardPrompt = false; loadReward(requestId); })
                .show();
    }

    private void loadReward(String requestId) {
        if (!eligible() || busy()) return;
        rewardLoading = true;
        int ticket = ++rewardTicket;
        int consentGeneration = generation;
        host.notice("Loading your optional reward ad…");
        handler.postDelayed(() -> {
            if (ticket != rewardTicket || !rewardLoading) return;
            rewardLoading = false;
            rewardTicket++;
            host.notice("The reward ad timed out. You can try again; no reward was granted.");
        }, 25_000);
        RewardedAd.load(host, BuildConfig.REWARDED_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override public void onAdLoaded(RewardedAd ad) {
                if (closed || ticket != rewardTicket || consentGeneration != generation) return;
                rewardLoading = false;
                if (!eligible() || fullScreen) {
                    host.notice("The reward ad was cancelled because the app was no longer ready.");
                    return;
                }
                fullScreen = true;
                boolean[] earned = {false};
                ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                    private void finished(boolean failed) {
                        fullScreen = false;
                        if (closed) return;
                        if (!earned[0]) host.notice(failed ? "The reward ad could not be shown. No reward was granted."
                                : "Ad closed without a completed reward. Nothing was unlocked.");
                        activate();
                    }
                    @Override public void onAdDismissedFullScreenContent() { finished(false); }
                    @Override public void onAdFailedToShowFullScreenContent(AdError error) { finished(true); }
                });
                // This SDK callback is the ONLY source of a reward event. Closing/loading never grants.
                ad.show(host, reward -> {
                    if (closed || earned[0]) return;
                    earned[0] = true;
                    adBreakUntil = SystemClock.elapsedRealtime() + AD_BREAK_MS;
                    destroyBanner();
                    interstitial = null;
                    handler.postDelayed(AdsController.this::activate, AD_BREAK_MS);
                    host.emit(MainActivity.event("reward", "requestId", requestId, "granted", true,
                            "amount", reward.getAmount(), "rewardType", reward.getType(), "test", !BuildConfig.PRODUCTION));
                });
            }
            @Override public void onAdFailedToLoad(LoadAdError error) {
                if (closed || ticket != rewardTicket) return;
                rewardLoading = false;
                host.notice("No reward ad is available. The offline library is still available.");
            }
        });
    }

    void pause() {
        if (banner != null) banner.pause();
        // An explicit request is not permission to surprise the user after a later resume.
        if (rewardLoading) { rewardTicket++; rewardLoading = false; }
    }

    private void destroyBanner() {
        if (banner != null) { banner.destroy(); banner = null; }
        container.removeAllViews();
        container.setVisibility(View.GONE);
    }

    private void invalidateAds() {
        generation++;
        rewardTicket++;
        rewardLoading = false;
        interstitialLoading = false;
        interstitial = null;
        destroyBanner();
    }

    private void ui(Runnable runnable) { host.runOnUiThread(() -> { if (!closed) runnable.run(); }); }

    void close() {
        closed = true;
        invalidateAds();
        handler.removeCallbacksAndMessages(null);
    }
}
