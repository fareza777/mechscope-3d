# Verification and device evidence

## Recorded result: 17 November 2026

The installed debug APK was tested on a Redmi Note 11, Android 13, using its native Android WebView. This is one-device QA, not broad Android or Google Play certification.

- Unit suite: 120 tests, 119 passed, zero failed, one optional WebGL test skipped.
- All nine mechanisms passed native collection checks: actual changing canvas pixels, anatomy metadata, solid/X-ray/section, exploded/reassembled transforms, input extremes, five lessons and one live canvas after model changes.
- All nine also passed desktop Chrome collection checks, including 360×640, 393×852, 852×393 and 1280×900 layouts.
- Visible key labels remain at least 12 CSS pixels. Nonessential statistics use 16-pixel numbers in a 40-pixel strip on the tested phone.
- The native viewer increased from approximately 308 to 373 CSS pixels high after compacting the statistics and header. Its backing buffer remained 1080 pixels wide at device-pixel-ratio 2.75.
- Navigation bottom padding was 6 pixels after eliminating a duplicated 48-pixel safe inset. The native test banner remained outside the WebView controls.
- High quality was selected successfully while the permanent Remove Ads entitlement was false, without watching an ad or purchasing.
- Negative controls reject unreachable kinematic inputs, coplanar rod/disk interference and a deliberately overlapping viewer button. An independent layout check rejected an oversized statistics panel.

### Native Efficient-profile frame timings

Each entry sampled 120 animation-frame intervals while the model was playing in the Explore view. Measurements are short samples, not a sustained thermal or worst-case latency guarantee.

| Model | Median ms | Mean ms | p95 ms |
|---|---:|---:|---:|
| ARACHNE | 16.7 | 21.30 | 33.5 |
| IGNIS | 16.7 | 21.86 | 33.5 |
| VENTUS | 16.7 | 21.30 | 33.5 |
| VECTOR | 16.7 | 23.81 | 33.6 |
| SCORPIO | 16.7 | 17.82 | 33.4 |
| LIBELLE | 16.7 | 16.71 | 16.8 |
| MANTIS | 16.7 | 16.71 | 16.8 |
| OCTAVIA | 16.7 | 16.71 | 16.8 |
| PISCES | 16.7 | 16.85 | 16.8 |

All entries met the current automated gates: median ≤20 ms, mean ≤25 ms and p95 ≤35 ms. An individual VECTOR interval reached approximately 100 ms. The results do not mean that every mechanism sustains 60 FPS or never stutters. High and Balanced quality are freely selectable but were not certified to these native performance gates.

## Reproduce the source checks

```sh
npm ci
npm test
npm run build
npm run preview -- --port 5174 --strictPort
```

In another terminal:

```sh
node scripts/collection-qa.mjs
```

The separate `node scripts/browser-qa.mjs` golden-path runner targets the development server on port 5173 by default. Set `MECHSCOPE_URL` to use another local server. Do not rebuild the served bundle while a test is running.

The current browser drivers specify the Windows Chrome executable. Adjust that path for another machine. They create the ignored `qa/` output directory automatically. Generated captures, device identifiers and raw local reports are not published in Git.

## Native Android checks

Build and install the debug variant as described in the README. Select the intended device explicitly; do not run ADB against an unspecified device. Example PowerShell setup with your own device serial:

```powershell
$env:MECHSCOPE_ADB_SERIAL = 'DEVICE_SERIAL'
$appPid = (adb -s $env:MECHSCOPE_ADB_SERIAL shell pidof dev.f7.mechscope).Trim()
adb -s $env:MECHSCOPE_ADB_SERIAL forward tcp:57405 "localabstract:webview_devtools_remote_$appPid"
$env:MECHSCOPE_CDP = 'http://127.0.0.1:57405'
node scripts/collection-qa.mjs --android
```

Use a free local port, and rebind it after reinstalling or restarting the app. The QA/release variants disable WebView debugging. Native screenshot capture requires Python with Pillow and the configured Android SDK path.

`android-capture.mjs` is deliberately constrained to the verified 1080×2400 portrait device geometry, with app bounds excluding system bars. It requires MechScope in the foreground and rejects captures when header pixels indicate an obstructing system overlay. Revalidate bounds before using another device or orientation; never substitute unrestricted desktop/device screenshots. Keep unrelated notifications and personal content out of published evidence.

## Remaining release gates

The native collection suite is not proof of actual Play billing, UMP regional policy compliance, rewarded-ad completion/expiry, refund handling, sustained thermal performance, low-memory recovery or every rotation/keyboard/device combination. Complete the owner-controlled configuration and testing in [RELEASE.md](RELEASE.md) before calling any artifact production-ready.
