# MechScope 3D: How It Works

An offline mechanical anatomy studio by **F7 Developer**, with twenty interactive mechanisms built from procedural geometry and deterministic kinematics. The flagship is **ARACHNE SC–08**, an original eight-legged robotic spider.

| Mechanism | Focus |
|---|---|
| ARACHNE SC–08 | Eight-legged spider, inverse kinematics and actuators |
| IGNIS V8 | Cross-plane engine, slider-cranks and valve timing |
| VENTUS J20 | Twenty-leg Jansen walker |
| VECTOR RG–2 | Oblique-axis retractable landing gear |
| SCORPIO S8 | Eight legs, opposed claws and articulated tail |
| LIBELLE D4 | Four crank-rocker-driven dragonfly wings |
| MANTIS M6 | Four support legs and two articulated graspers |
| OCTAVIA O8 | Eight curling arms, 64 rigid spans and tendon guides |
| PISCES K9 | Traveling-wave robotic koi, fins and linked gill covers |
| CRUSTA C10 | Side-stepping crab, eight walking legs and two articulated pincers |
| MYRIA M24 | Twelve-body-module centipede and 24 phase-offset legs |
| NAJA N18 | Eighteen-link cobra spine, expanding hood and articulated head |
| CHELON T4 | Armored tortoise, four walking limbs and articulated neck |
| ALULA H2 | Hummingbird automaton, feathered wings and linked shoulder drives |
| DEXTRA H5 | Five-finger robotic hand, articulated knuckles and tendon drives |
| ASTRA R9 | Nine-cylinder radial piston mechanism and timed valve gear |
| ORBIT P3 | Three-planet epicyclic transmission and visible carrier drive |
| TITAN S6 | Six-wheel steam locomotive, quartered cranks and coupling rods |
| CHRONOS T3 | Open tourbillon movement, rotating cage and oscillating balance |
| DRACONIS D6 | Winged dragon: four digitigrade IK legs, folding membrane wings, 34 vertebrae and a six-act choreography |

## Release status

**Engineering QA build — not a Google Play production release.** The source implements real interactive 3D, not a prerecorded mechanism video. QA APK/AAB files use Google test advertising IDs and a debug signing key. They are not suitable for upload as a production release. A successful build is not evidence of purchase, consent, advertising, physical-simulation or visual-quality certification.

The production Gradle variant refuses to build without real advertising configuration, a Play billing public key, a published privacy-policy URL, explicit Console setup confirmations and production signing credentials. See [release requirements](docs/RELEASE.md) and [test evidence](docs/TESTING.md).

## The experience

- **Explore:** Twenty PBR procedural mechanisms, environment reflections, studio lighting, shadows, 360° orbit, pinch zoom, camera presets and immersive view. Playback and camera controls stay outside the canvas; compact statistics preserve viewer space.
- **Anatomy:** Select model components or search the component index; inspect purpose, mechanism, material and live readouts. Solid, X-ray and section modes.
- **How it works:** Five measured, model-specific lessons per mechanism, linked to camera, material and explosion states.
- **Exploded:** Continuously separate and reassemble subassemblies without switching to a video or another model.
- **Simulation:** Adjust each mechanism's bounded inputs. Pause, slow down, single-step or scrub its deterministic cycle; displayed measurements come from the same sampled pose.
- English and light appearance by default, optional dark/system themes, bundled fonts, reduced-interface-motion setting and persistent preferences.
- Native MechScope launch screen, followed by the supplied official F7 Developer brand ident.
- Native share, rating, UMP consent, separated adaptive banner, frequency-limited interstitial, explicit rewarded ad and non-consumable Remove Ads with restore.

## What the simulation means

The foot trajectory defines each leg's target. A three-axis inverse-kinematics solution maintains fixed coxa, femur and tibia lengths. The same pose drives visible links, joint-angle readouts, actuator extension and support-contact indicators. Gait sampling is repeatable for an arbitrary timestamp.

The nominal geometry uses a 130 mm coxa, 530 mm femur, 660 mm tibia and 130 mm tarsus. The gait has a 62% stance duty factor and two groups offset by half a cycle. The illustrative drivetrain has a 12-tooth pinion and 36-tooth output gear.

**This is a kinematic educational model, not validated robot CAD or a dynamics solver.** The app does not predict forces, friction, collisions, actuator loads, fatigue, battery consumption or real-world stability. Materials and shell construction are artistic design representations. It is not presented as an existing Elvar spider asset.

## Primary reference and license

The only primary mechanical visualization reference is [elvarofficial/teardown](https://github.com/elvarofficial/teardown), audited at `a91262ac1109051e014662d42ecb0b7bc1f113b1`. Its MIT license permits commercial use with retained notices. The repository supplies V8, Cessna and Strandbeest source examples—not a Mechanical Spider model.

See [the audit](docs/REFERENCE-AUDIT.md) for capabilities, source evidence, adaptations, example builds, limitations and redistribution requirements. Complete Teardown, Three.js and bundled-font licenses are included in `public/licenses.txt` and the app's About screen.

Application source is MIT. Supplied F7 Developer brand assets and trademarks are excluded from that source license.

## Architecture

```text
src/catalog.js          mechanism descriptors and lazy geometry loading
src/spider/kin.js        pure math, design dimensions, trajectories and lessons
src/spider/model.js      procedural geometry, component metadata, posed assemblies
src/mechanisms/          nineteen additional descriptors, samplers and geometry models
src/viewer/stage.js      Three.js lighting, environment, camera, picking and quality
src/main.js             mobile interface, state, settings and native bridge
src/style.css           responsive light/dark interface
android/                native Android host, ads, billing, splash and security
public/                 offline brand assets and license notices
scripts/                Android asset sync and browser/device QA driver
tests/                  deterministic kinematic and geometry gates
```

Mechanisms expose a model factory, deterministic state sampler, metadata and capabilities through the catalog. Geometry is not embedded in the native Android host. New mechanisms can reuse the stage, inspection controls, Android integrations and artifact workflow while supplying their own parameter panel and domain-specific lessons.

### Renderer and device boundaries

- Three.js 0.187.0; WebGL 2 / OpenGL ES 3 required.
- Native Java host using AndroidX WebKit, not an externally hosted website.
- Minimum Android 8 (API 26), target/compile API 36; a current Android System WebView is required.
- Local assets are served from the exact `https://appassets.androidplatform.net/assets/web/` origin. File/content access, untrusted navigation, remote subresources, pop-ups, file uploads, camera, microphone and geolocation are blocked in the privileged renderer.
- Native messaging accepts only that exact main-frame origin. Outgoing data is JSON-escaped.
- JavaScript code and fonts are bundled. Native ads and Play operations need connectivity, but mechanical exploration does not.
- Every quality mode uses screen pixel density, capped at device-pixel-ratio 3, rather than low-resolution upscaling. Efficient reduces micro-detail and shadow cost; Balanced and High add detail. All settings and mechanisms are free, without rewarded-ad or purchase locks.

## Develop

Install Node.js 22.12+ or 24, then:

```sh
npm ci
npm test
npm run dev
```

Open the local development URL printed by Vite. No API key or remote model download is required.

```sh
npm run build
npm run sync:android
```

### Build Android

Install Android SDK 36 and build-tools 36.0.0, plus JDK 21. Supply an ignored `android/local.properties` with your SDK location or set `ANDROID_HOME`.

```powershell
$env:JAVA_HOME = 'C:/path/to/jdk-21'
./android/gradlew.bat -p android :app:assembleDebug :app:assembleQa :app:bundleQa --no-daemon --max-workers=2
```

`debug` enables WebView debugging for QA. `qa` disables WebView debugging, retains test ad IDs and uses the standard debug signing key. `release` is a separately gated, minified, production-signed variant.

Expected output locations:

```text
android/app/build/outputs/apk/debug/app-debug.apk
android/app/build/outputs/apk/qa/app-qa.apk
android/app/build/outputs/bundle/qa/app-qa.aab
```

Never commit signing keys, `production.properties`, local SDK paths, private account files or credentials. Git ignore rules cover these files.

## Verification

```sh
npm test
node scripts/browser-qa.mjs
npm run build
npm run preview -- --port 5174 --strictPort
# In another terminal:
node scripts/collection-qa.mjs
node scripts/pose-qa.mjs
```

The browser runner assumes Vite is running and uses an installed Chrome executable. Adapt its executable path for another development machine. It checks onboarding, pause/step/timeline, camera, component search, material modes, explosion/reassembly, simulation controls, lessons, themes, quality and responsive layouts. It records actual results and page-only screenshots under `qa/`.

The same runner can attach to a **debug** MechScope Android WebView using an explicitly selected device and an ADB-forwarded target socket. See [testing](docs/TESTING.md). Numerical tests include negative controls and do not print unconditional success.

## Monetization and privacy

The target US base price for the permanent `remove_ads` product is **$4.99**, configured in Play Console. Checkout uses the localized price provided by Google Play; the UI does not fabricate a price or entitlement when configuration is missing. Restored purchases require a valid signature and correct package/product/state. Pending purchases are not granted. Signed acknowledged receipts support offline access but cannot detect refunds or account changes until reconnection.

Consent is required before ads can be requested. Banners occupy a native container outside the viewer and above system-navigation insets. Interstitials are limited to a collection transition, never shown on first launch, and rate-limited to at least three minutes. Rewarded ads are explicitly requested and grant a 15-minute ad break in the current app session only from the SDK's earned-reward callback. They never change rendering quality or unlock settings. All twenty offline mechanisms remain available without watching an ad.

For production hardening, add a secure Play Developer API purchase-verification backend and real-time developer notifications, complete policy review and test actual purchase/cancellation/refund/restore flows on a Play test track.
