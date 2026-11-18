# Verification and device evidence

## Thirty-mechanism motion and horse verification: 18 November 2026

EQUUS H8 (collection 030) was added, and eight existing mechanisms were rebuilt for thicker silhouettes and continuous motion: SENTINEL H9, MAMMUT M4, ABYSS S9, CERVUS B6, SPECULA O6, FABER R6, CHRONOS T3 and ORBIT P3. The changes were verified against the final source and production bundle in desktop Chrome.

- Unit and integration suite: **306 tests, 305 passed, zero failed, one optional WebGL test skipped**.
- The suite now includes `tests/motion.test.mjs`, a global gate that samples nine non-commensurate cycle phases per mechanism and requires at least `max(20, ceil(parts × 0.18))` moving part IDs and at least 24 moving instances. All thirty mechanisms pass. This avoids the phase-aliasing that made integer-ratio gear trains look motionless at simple fractions of their cycle.
- All thirty mechanisms passed the desktop Chrome collection suite: measured changing pixels, real instance-transform pause/step behaviour, anatomy metadata and search, solid/X-ray/section, exact exploded and reassembled transforms, every simulation input at both limits, all five lessons, one live canvas per model, no controls over the canvas, labels of at least 12 CSS pixels, full-pixel-density rendering and responsive 360×640, 393×852, 852×393 and 1280×900 layouts.
- The production web bundle builds successfully. No 30-mechanism APK was installed or frame-timed on a phone: the previously used Redmi Note 11 was disconnected. Native results below remain historical evidence and do not certify this build.

Motion counts over the nine non-commensurate phases (moving part IDs / total, then moving instances): SENTINEL 240/240 and 2,005; MAMMUT 266/274 and 1,855; ABYSS 159/167 and 1,464; CERVUS 182/190 and 1,410; SPECULA O6 165/194 and 1,433; FABER R6 123/180 and 807; CHRONOS T3 120/176 and 1,681; ORBIT P3 118/196 and 1,032; EQUUS 120/120 and 924. Fixed display bases remain static; the reworked models and EQUUS H8 are additionally covered by model-specific gates that name their moving subsystems.

## DRACONIS D6 addition: 18 November 2026

DRACONIS D6 (collection 029, winged dragon) was verified in a Linux container: `npm test`, `npm run build`, and `pose-qa.mjs` restricted to `dragon` in headless Chromium with SwiftShader (24 rendered poses fit the home camera). `collection-qa.mjs` and native Android runs were **not** repeated for that isolated addition; the thirty-mechanism pass above supersedes this entry. The stage accepts optional `framePoints` from a model so the home camera fits whole-cycle geometry of shape-changing mechanisms; models without it keep the previous box fit.

## Nineteen-mechanism verification: 17 November 2026

The collection was expanded from nine to nineteen mechanisms. The following local results were recorded against the final source and production bundle at that time. SENTINEL H9 (collection 020) was added after that pass, followed by MAMMUT M4, ABYSS S9 and CERVUS B6 (collections 021–023), then ASTRARIUM OR-9, TERRA X7, SPECULA O6, HARMONIA P8 and FABER R6 (collections 024–028). The thirty-mechanism verification above supersedes this section; the 28-mechanism build was not independently rerun through the full browser collection QA before the final expansion.

- Unit and integration suite: **218 tests, 217 passed, zero failed, one optional WebGL test skipped**.
- All nineteen mechanisms passed the desktop Chrome collection suite: measured changing pixels, real instance-transform pause/step behaviour, anatomy metadata and search, solid/X-ray/section, exact exploded and reassembled transforms, every simulation input at both limits, all five lessons, one live canvas per model, no controls over the canvas, labels of at least 12 CSS pixels, full-pixel-density rendering and responsive 360×640, 393×852, 852×393 and 1280×900 layouts.
- The ten new mechanisms additionally passed a 24-pose framing sweep each (240 rendered poses across minimum/default/maximum control settings): every submitted vertex stayed inside the home camera and in front of it. A deliberately collapsed-camera negative control was rejected.
- Compact statistics remain a 40-pixel strip at 393 pixels wide, and every statistics label fits in its cell.
- The final production web bundle was built and synced into the Android assets. The debug APK was rebuilt successfully.

- At the end of that 28-model phase the suite recorded **252 tests, 251 passed, zero failed, one optional WebGL test skipped**, and the production web bundle built successfully.

**Not yet re-verified on the phone:** the Redmi Note 11 used for earlier native testing was disconnected before the nineteen-model APK could be installed. The native results below are the historical nine-mechanism evidence and do not certify later models, the current APK or its frame times. Re-run the native collection command after reconnecting the explicitly selected device.

### New-mechanism geometry budgets

Measured from submitted instance buffers in the model tests; low tiers keep every selectable assembly.

| Mechanism | Parts | Balanced instances | Balanced triangles | Low triangles | Batches |
|---|---:|---:|---:|---:|---:|
| CRUSTA C10 | 134 | 1,942 | 105,168 | 69,576 | 22 |
| MYRIA M24 | 216 | 2,335 | 118,500 | 79,764 | 18 |
| NAJA N18 | 148 | 1,620 | 88,704 | 69,408 | 18 |
| CHELON T4 | 181 | 1,998 | 100,860 | 76,368 | 19 |
| ALULA H2 | 143 | 1,846 | 111,240 | 74,640 | 18 |
| DEXTRA H5 | 168 | 2,195 | 113,052 | 72,900 | 16 |
| ASTRA R9 | 177 | 2,139 | 132,780 | 79,308 | 18 |
| TITAN S6 | 125 | 1,823 | 87,420 | 56,148 | 19 |
| CHRONOS T3 | 176 | 2,282 | 97,740 | 79,728 | 16 |
| SENTINEL H9 | 240 | 2,005 | 102,360 | 59,616 | 31 |
| MAMMUT M4 | 274 | 1,895 | 108,132 | 58,704 | 26 |
| ABYSS S9 | 167 | 1,528 | 82,236 | 56,124 | 22 |
| CERVUS B6 | 190 | 1,450 | 91,992 | 57,888 | 26 |
| ASTRARIUM OR-9 | 102 | 1,322 | 65,448 | 58,332 | 20 |
| TERRA X7 | 84 | 577 | 30,312 | 22,032 | 21 |
| SPECULA O6 | 194 | 1,698 | 92,172 | 50,412 | 22 |
| HARMONIA P8 | 118 | 712 | 41,724 | 25,908 | 16 |
| FABER R6 | 180 | 1,187 | 69,720 | 34,980 | 29 |
| ORBIT P3 | 196 | 2,135 | 88,920 | 61,368 | 20 |
| EQUUS H8 | 120 | 924 | 43,392 | 30,072 | 24 |

### Historical native result: nine-mechanism APK

The installed debug APK was tested on a Redmi Note 11, Android 13, using its native Android WebView. This is one-device QA, not broad Android or Google Play certification.

- Unit suite at that time: 120 tests, 119 passed, zero failed, one optional WebGL test skipped.
- All nine mechanisms passed native collection checks: actual changing canvas pixels, anatomy metadata, solid/X-ray/section, exploded/reassembled transforms, input extremes, five lessons and one live canvas after model changes.
- All nine also passed desktop Chrome collection checks, including 360×640, 393×852, 852×393 and 1280×900 layouts.
- Visible key labels remain at least 12 CSS pixels. Nonessential statistics use 16-pixel numbers in a 40-pixel strip on the tested phone.
- The native viewer increased from approximately 308 to 373 CSS pixels high after compacting the statistics and header. Its backing buffer remained 1080 pixels wide at device-pixel-ratio 2.75.
- Navigation bottom padding was 6 pixels after eliminating a duplicated 48-pixel safe inset. The native test banner remained outside the WebView controls.
- High quality was selected successfully while the permanent Remove Ads entitlement was false, without watching an ad or purchasing.
- Negative controls reject unreachable kinematic inputs, coplanar rod/disk interference and a deliberately overlapping viewer button. An independent layout check rejected an oversized statistics panel.

### Native Efficient-profile frame timings (nine-model build)

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
node scripts/pose-qa.mjs
```

`collection-qa.mjs` covers every mechanism in the catalog plus responsive layouts. `pose-qa.mjs` sweeps 24 rendered poses per new mechanism (minimum, default and maximum inputs), projects every submitted vertex through the home camera and rejects clipping with an independently collapsed-camera negative control.

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
