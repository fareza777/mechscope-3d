package dev.f7.mechscope;

import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Non-consumable Play billing. There is deliberately no fake purchase pathway. */
final class BillingController {
    private final MainActivity host;
    private final SharedPreferences cache;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Set<String> acknowledgements = new HashSet<>();
    private final PublicKey publicKey;
    private final BillingClient client;
    private ProductDetails product;
    private ProductDetails.OneTimePurchaseOfferDetails offer;
    private boolean removed;
    private boolean cachedOnly;
    private boolean closed;
    private boolean connecting;
    private boolean purchaseInFlight;
    private int generation;
    private String price = "";

    BillingController(MainActivity host) {
        this.host = host;
        cache = host.getSharedPreferences("play_entitlement", 0);
        PublicKey parsed = null;
        try {
            parsed = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(
                    Base64.decode(BuildConfig.PLAY_BILLING_PUBLIC_KEY, Base64.DEFAULT)));
        } catch (Exception ignored) { /* Missing/invalid real Console config: billing stays unavailable. */ }
        publicKey = parsed;
        try {
            Purchase saved = new Purchase(cache.getString("purchase", ""), cache.getString("signature", ""));
            boolean acknowledged = saved.isAcknowledged() || saved.getPurchaseToken().equals(cache.getString("acknowledged_token", ""));
            removed = acknowledged && verified(saved);
            cachedOnly = removed;
        } catch (Exception ignored) { removed = false; }
        client = BillingClient.newBuilder(host)
                .setListener((result, purchases) -> ui(() -> {
                    purchaseInFlight = false;
                    if (ok(result) && purchases != null) {
                        process(purchases, false, true);
                    } else if (result.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
                        restore(true);
                    } else if (result.getResponseCode() != BillingClient.BillingResponseCode.USER_CANCELED) {
                        host.notice("Google Play could not complete the purchase. No new entitlement was granted.");
                    }
                }))
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
    }

    boolean adsRemoved() { return removed; }
    boolean cachedOnly() { return cachedOnly; }
    boolean available() { return publicKey != null && client.isReady() && product != null && offer != null; }
    String price() { return price; }

    void resume() {
        if (closed || publicKey == null) { host.onBillingStateChanged(); return; }
        if (client.isReady()) { queryProduct(false); restore(false); }
        else connect();
    }

    private void connect() {
        if (closed || connecting || publicKey == null) return;
        connecting = true;
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {
                ui(() -> {
                    connecting = false;
                    if (ok(result)) { queryProduct(false); restore(false); }
                    else { cachedOnly = removed; product = null; offer = null; }
                    host.onBillingStateChanged();
                });
            }
            @Override public void onBillingServiceDisconnected() {
                ui(() -> {
                    connecting = false;
                    product = null;
                    offer = null;
                    cachedOnly = removed;
                    host.onBillingStateChanged();
                    // Automatic reconnection handles the next query; foreground retry also restores.
                    handler.removeCallbacks(reconnect);
                    handler.postDelayed(reconnect, 5000);
                });
            }
        });
    }

    private final Runnable reconnect = this::reconnectWhenForeground;

    private void reconnectWhenForeground() { if (host.isForeground()) resume(); }

    void purchase() {
        if (removed) { host.notice("Remove Ads is already active."); return; }
        if (publicKey == null) {
            host.notice("Purchases are not configured in this QA build. No payment or entitlement is simulated.");
            return;
        }
        if (!client.isReady()) {
            connect();
            host.notice("Google Play is not connected. Check your connection and try again.");
            return;
        }
        if (purchaseInFlight) return;
        purchaseInFlight = true;
        // Refresh ProductDetails rather than launching with a potentially stale offer token.
        queryProduct(true);
    }

    private void queryProduct(boolean launch) {
        QueryProductDetailsParams.Product requested = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(BuildConfig.REMOVE_ADS_PRODUCT)
                .setProductType(BillingClient.ProductType.INAPP).build();
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(requested)).build(), (result, details) -> ui(() -> {
            product = null;
            offer = null;
            price = "";
            if (ok(result)) {
                for (ProductDetails candidate : details.getProductDetailsList()) {
                    if (!BuildConfig.REMOVE_ADS_PRODUCT.equals(candidate.getProductId())) continue;
                    List<ProductDetails.OneTimePurchaseOfferDetails> offers = candidate.getOneTimePurchaseOfferDetailsList();
                    if (offers == null) continue;
                    for (ProductDetails.OneTimePurchaseOfferDetails option : offers) {
                        // Remove Ads must be a permanent buy option, not a rental or preorder.
                        if (option.getRentalDetails() == null && option.getPreorderDetails() == null) {
                            product = candidate;
                            offer = option;
                            price = option.getFormattedPrice();
                            break;
                        }
                    }
                }
            }
            host.onBillingStateChanged();
            if (!launch) return;
            if (!available() || !host.isForeground() || !host.canPresentNativeUi()) {
                purchaseInFlight = false;
                host.notice("Remove Ads is unavailable. Install from Google Play with an eligible account and try again.");
                return;
            }
            BillingFlowParams.ProductDetailsParams selection = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(product).setOfferToken(offer.getOfferToken()).build();
            BillingResult launched = client.launchBillingFlow(host, BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(selection)).build());
            if (!ok(launched)) {
                purchaseInFlight = false;
                host.notice("Google Play could not open checkout. You have not been charged by this app.");
            }
        }));
    }

    void restore(boolean explicit) {
        if (closed) return;
        if (publicKey == null || !client.isReady()) {
            if (publicKey != null) connect();
            if (explicit) host.notice(publicKey == null
                    ? "Restore requires the real app's Play billing configuration; this QA build cannot simulate ownership."
                    : "Connect to Google Play to restore. Any previously verified local purchase remains cached.");
            return;
        }
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP).build(), (result, purchases) -> ui(() -> {
            if (ok(result)) process(purchases, true, explicit);
            else {
                cachedOnly = removed;
                if (explicit) host.notice("Restore could not reach Google Play. A cached receipt cannot check refunds or account changes offline.");
                host.onBillingStateChanged();
            }
        }));
    }

    private void process(List<Purchase> purchases, boolean authoritative, boolean explicit) {
        Purchase owned = null;
        boolean pending = false;
        for (Purchase purchase : purchases) {
            if (!purchase.getProducts().contains(BuildConfig.REMOVE_ADS_PRODUCT)) continue;
            if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
            if (verified(purchase)) owned = purchase;
        }
        if (owned == null) {
            if (authoritative) {
                generation++;
                removed = false;
                cachedOnly = false;
                cache.edit().clear().apply();
                host.onBillingStateChanged();
            }
            if (explicit || pending) host.notice(pending
                    ? "Payment is pending. Ads are removed only after Google Play confirms the purchase."
                    : "No verified Remove Ads purchase was found for this Google Play account.");
            return;
        }
        Purchase confirmed = owned;
        if (confirmed.isAcknowledged()) {
            grant(confirmed, explicit);
            return;
        }
        String token = confirmed.getPurchaseToken();
        if (!acknowledgements.add(token)) return;
        int expectedGeneration = generation;
        client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build(), result -> ui(() -> {
            acknowledgements.remove(token);
            if (expectedGeneration != generation) return;
            if (ok(result)) {
                grant(confirmed, explicit);
                // Fetch the acknowledged, signed receipt for safe persistence across process restarts.
                restore(false);
            } else if (explicit) {
                host.notice("Purchase confirmation is incomplete. Reconnect and restore; no unconfirmed entitlement was granted.");
            }
        }));
    }

    private boolean verified(Purchase purchase) {
        if (publicKey == null || purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED
                || purchase.isSuspended() || !BuildConfig.APPLICATION_ID.equals(purchase.getPackageName())
                || !purchase.getProducts().contains(BuildConfig.REMOVE_ADS_PRODUCT)
                || purchase.getPurchaseToken().isEmpty() || purchase.getQuantity() != 1) return false;
        try {
            // Play's RSA receipt signature uses SHA1withRSA. Never accept unsigned JSON or a test boolean.
            Signature verifier = Signature.getInstance("SHA1withRSA");
            verifier.initVerify(publicKey);
            verifier.update(purchase.getOriginalJson().getBytes(StandardCharsets.UTF_8));
            return verifier.verify(Base64.decode(purchase.getSignature(), Base64.DEFAULT));
        } catch (Exception ignored) { return false; }
    }

    private void grant(Purchase purchase, boolean explicit) {
        removed = true;
        cachedOnly = false;
        // Acknowledgment can succeed before Play returns an updated signed receipt.
        cache.edit().putString("purchase", purchase.getOriginalJson())
                .putString("signature", purchase.getSignature())
                .putString("acknowledged_token", purchase.getPurchaseToken()).apply();
        host.onBillingStateChanged();
        if (explicit) host.notice("Remove Ads is active. Thank you. Restore it with the same Google Play account.");
    }

    private static boolean ok(BillingResult result) {
        return result.getResponseCode() == BillingClient.BillingResponseCode.OK;
    }

    private void ui(Runnable operation) { host.runOnUiThread(() -> { if (!closed) operation.run(); }); }

    void close() {
        closed = true;
        handler.removeCallbacksAndMessages(null);
        client.endConnection();
    }
}
