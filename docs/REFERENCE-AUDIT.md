# Teardown reference audit

Audited 17 November 2026. Primary and only mechanical implementation reference: https://github.com/elvarofficial/teardown at `a91262ac1109051e014662d42ecb0b7bc1f113b1`.

## Scope and findings

The repository is a Three.js procedural mechanical visualization toolkit and authoring skill, not an Android engine, CAD asset collection, or validated physics system. Its complete executable examples are a V8, Cessna 337 landing gear, and Jansen Strandbeest. Its README also shows bee, scorpion, and octopus GIFs. It does **not** ship a mechanical spider model.

The audit covered the root build/capture/contact-sheet/wave helpers, every substantive `sims/kit` module, geometry/kinematics/stage/console/live/film/score modules of all three examples, and the procedural audio modules and recorded-sample provenance. All three original live examples were successfully bundled locally: V8 806 KB, Cessna 799 KB, Strandbeest 799 KB. Source-level findings are not device performance measurements.

## Techniques carried into MechScope

- Separate mathematical pose state, procedural geometry, lighting/camera, and UI.
- One gait phase drives foot trajectories, joint solutions, gear motion, actuator endpoints, and displayed values.
- Shared geometry and instancing for repetitive mechanical detail.
- Real-time shell transparency, section planes, component picking, and deterministic exploded transforms.
- Light studio, restrained accent, environment reflections and directional shadows.
- Shader compilation before showing the viewer; native-resolution rendering with mobile geometry/shadow tiers.
- Offline JavaScript, fonts and geometry, without CDN dependencies.
- Review current rendered frames rather than infer appearance from geometry counts.

This app contains sixteen newly authored conceptual mechanisms alongside adaptations of the reference V8, Cessna gear and Strandbeest. The original six biomimetic designs (spider, scorpion, dragonfly, mantis, octopus and koi) are joined by a crab, centipede, cobra, tortoise, hummingbird, robotic hand, radial piston mechanism, planetary transmission, steam locomotive and tourbillon movement. These ten additions are new procedural designs using the same pose/geometry/instancing workflow, not additional models supplied by Teardown. The V8 retains the source rig with additional timing gears; the landing gear retains the source oblique retraction mechanism on a lifted service fixture; the walker retains the source Jansen closure and station phasing. All nineteen share a redesigned mobile interface rather than embedding the reference desktop consoles. They do not claim physical validation or visual parity with a reference promotional film.

## Important source evidence

| Reference | Observation |
|---|---|
| `sims/kit/runtime.js:57–64,119–131` | Deterministic render contract and capture loop. |
| `sims/v8-shared/film.js:33–49` | Preintegrated speed and timestamp-addressable crank state. |
| `sims/strandbeest-shared/beast.js:109–135,244–286,324–385` | Shared cylinder/cap geometries and dynamic instancing. |
| `sims/v8-shared/engine.js:18–73,404–475,486–505` | Procedural components, explosion, transparency and clipping. |
| `sims/cessna-shared/gear.js:255–308,310–361` | Mirrored assemblies and actuator/rotation relationships. |
| `sims/kit/warm.js:29–65` | Shader warm-up, including version-sensitive private renderer internals. |
| `sims/strandbeest-shared/jansen.js:8–38` | Specialized circle-intersection solver, not a general spider solver. |
| `sims/v8-shared/kin.js:1–3,66–77` | Illustrative rather than validated pressure modeling. |
| `sims/v8-shared/live.js:27–41,64–91,183–219,242–269` | Desktop-scaled console and wheel-oriented navigation, requiring mobile redesign. |
| `sims/v8-shared/stage.js:22–51,103–105` | Expensive render-target/AO/shadow defaults unsuitable as unmeasured mobile defaults. |
| `sims/kit/director.js:234–258` | Content insertion unsuitable for untrusted native-bridge input. |
| `sfx/mix.py:15–45,53–111` | Offline sound synthesis/mixing/mastering; not an Android runtime. |

## Pitfalls deliberately not copied

The supplied live examples continue rendering during pause and may automatically resume tours after inactivity. MechScope does not restart user-paused motion or run an unattended tour. It has Android lifecycle handling and two-finger touch controls. Heavy GTAO/postprocessing and 4096-pixel shadows are not the default. Unreachable IK targets are rejected and negative-control tested instead of concealing impossible geometry with numerical clamps.

Reference capture produces film frames, not proof of live Android rendering. Ads, billing, consent, entitlement restoration, release configuration and app signing must be implemented separately.

## Licensing

Teardown is MIT, with copyrights for **elvarofficial** and **whaleyxbt**. Preserve both and the complete permission/warranty text when distributing derivative portions. Complete notices are bundled in `public/licenses.txt` and accessible inside the app. Three.js is MIT; Inter and JetBrains Mono are SIL Open Font License 1.1. Development tools are not included in the APK as tools.

The twelve reference recorded samples are documented as CC0 with Freesound provenance, but MechScope does not include them. F7 Developer's supplied mark and splash video are separate brand assets, not sublicensed under the application's source license. No other repository, downloaded 3D asset, generated Meshy asset, or third-party spider design was used as the main model reference.
