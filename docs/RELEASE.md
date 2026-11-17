# Release configuration and remaining gates

## QA versus production

`assembleQa` and `bundleQa` produce a non-debuggable QA build with Google's sample ad IDs and Android's local debug signing key. They are install/test artifacts, **not Play-production-ready deliverables**. `assembleDebug` uses the same features with WebView debugging enabled for instrumentation.

`assembleRelease` / `bundleRelease` are intentionally blocked without the configuration below. A `.aab` extension or successful ZIP/signature check alone is not permission to publish a QA artifact.

## Required owner-controlled configuration

Copy `android/production.properties.example` to the ignored `android/production.properties`, or use environment variables. Supply:

- `ADMOB_APP_ID`: the app's real Android AdMob application ID.
- `ADMOB_BANNER_ID`, `ADMOB_INTERSTITIAL_ID`, `ADMOB_REWARDED_ID`: separate, real ad units owned by the publisher.
- `PLAY_BILLING_PUBLIC_KEY`: the Play Console licensing/billing RSA public key for `dev.f7.mechscope`.
- `PRIVACY_POLICY_URL`: a published HTTPS privacy policy covering actual SDK behavior, consent choices, purchases, retention, contact details and data rights.
- `PLAY_PRODUCT_READY=true`: only after creating and activating the permanent, non-consumable `remove_ads` product, setting the US base price to $4.99 and reviewing localized prices.
- `UMP_CONFIGURED=true`: only after configuring consent messages and privacy-options behavior in the actual AdMob account.

Signing comes **only** from environment variables:

- `MECHSCOPE_KEYSTORE`
- `MECHSCOPE_STORE_PASSWORD`
- `MECHSCOPE_KEY_ALIAS`
- `MECHSCOPE_KEY_PASSWORD`

Back up the owner-controlled signing key securely; do not publish it in GitHub, releases, logs or screenshots. Use Play App Signing and an appropriate upload key. Do not treat the debug key used for QA as a production upload key.

## Production verification that cannot be replaced by a local build

1. Create the Play app with package `dev.f7.mechscope`, resolve title/listing availability and register the signing certificate.
2. Publish the privacy policy, supply developer contact/support information and complete Data Safety, ads and content-rating declarations based on the final SDK dependencies and merged manifest.
3. Configure UMP and test required/non-required/error paths in applicable regions, consent refusal/revocation, no network and children/age-audience requirements. Do not bypass UMP to make sample ads appear.
4. On a Play internal test track, verify successful purchase, cancellation, pending transaction, acknowledgement, already-owned purchase, reinstall restore, changed account, refund/revocation and offline cache behavior. Do not exercise real payments through mock callbacks.
5. Add server-side Play purchase verification and real-time developer notifications before relying on the client receipt cache as production entitlement infrastructure. The current implementation verifies RSA receipts locally but cannot validate current account ownership or revoke an offline receipt.
6. Verify actual banner sizing with system navigation, keyboard, rotation and large fonts; inspect interstitial timing after at least three minutes and confirm first-launch suppression. Verify reward is granted only on the earned callback, never on load/dismiss/failure.
7. Run sustained device testing, low-memory/background/foreground testing and visual review across representative Android GPU/WebView versions. The available Redmi Note 11 is one device, not broad certification.
8. Review the conceptual mechanical design for visible intersections and control limits. Numerical link-length validation is not a collision or dynamics proof.
9. Review the full source/dependency notices and F7 branding rights. Keep Teardown's two copyright notices and bundled font licenses in the app.
10. Build, verify and upload a production-signed AAB; inspect Play pre-launch results, Android vitals and Play policy warnings before rollout.

## Public repository and releases

The source repository may be public as requested. Public release artifacts must be labeled QA until the production gates above have actually been completed. Never publish secrets, keystores, receipts, device personal data, full-desktop captures or machine-local configuration.

The official F7 splash is a supplied brand-ident asset. The mechanical animation is not prerecorded footage and does not depend on a remote generation service.
