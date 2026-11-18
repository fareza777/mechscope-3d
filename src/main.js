import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import './style.css';
import { icon } from './icons.js';
import { MECHANISMS } from './catalog.js';
import { createStage } from './viewer/stage.js';
import { HOME_VIEWS } from './viewer/orientation.js';
let mechanism = MECHANISMS[0];
let { sample: sampleSpider, defaultInputs: DEFAULT_INPUT, lessons: LESSONS } = mechanism;
const cycleHz = () => mechanism.cycleHz(state.input);

const $ = s => document.querySelector(s);
const all = s => [...document.querySelectorAll(s)];
const saved = (() => { try { return JSON.parse(localStorage.getItem('mechscope.preferences') || '{}'); } catch { return {}; } })();
const state = {
  mode: 'explore', surface: 'solid', playing: true, speed: 1, t: 0, explode: 0, explodeTarget: 0,
  selected: null, lesson: 0, input: { ...DEFAULT_INPUT },
  quality: ['low', 'balanced', 'high'].includes(saved.quality) ? saved.quality : window.NativeBridge ? 'low' : 'balanced',
  theme: ['light', 'dark', 'system'].includes(saved.theme) ? saved.theme : 'light',
  reduced: typeof saved.reduced === 'boolean' ? saved.reduced : matchMedia('(prefers-reduced-motion: reduce)').matches,
  native: { native: !!window.NativeBridge, adsRemoved: false, billingAvailable: false, price: '', adMode: 'test', version: '1.0.0-browser' },
};
const modeItems = [ ['explore','explore','Explore'], ['anatomy','anatomy','Anatomy'], ['learn','motion','Learn'], ['explode','explode','Exploded'], ['simulate','simulate','Simulate'] ];
const app = $('#app');
app.classList.add('clear-view');
app.innerHTML = `
  <header class="app-header">
    <button class="brand" id="library" aria-label="Open collection"><img src="./brand/mechscope.svg" alt=""/><span>MechScope<span class="brand-3d">3D</span><small>HOW IT WORKS</small></span></button>
    <div class="header-actions"><span class="offline">${icon('check')} OFFLINE READY</span><button class="icon-button" id="settings" aria-label="Settings">${icon('settings')}</button></div>
  </header>
  <main id="workspace">
    <section class="machine-title"><div><span class="eyebrow" id="machine-family">MECHANICAL SPIDER · 001 / ${String(MECHANISMS.length).padStart(3, '0')}</span><h1 id="machine-name">ARACHNE SC–08</h1></div><div class="machine-actions"><div class="mechanism-pager" role="group" aria-label="Browse mechanisms"><button class="pager-button" id="previous-mechanism" aria-label="Previous mechanism">${icon('back')}</button><button class="collection-switch" id="collection-switch" aria-label="Choose a mechanism">${icon('anatomy')}<span>Collection</span></button><button class="pager-button" id="next-mechanism" aria-label="Next mechanism">${icon('chevron')}</button></div><button class="spec-button" id="machine-info" aria-label="Mechanism field notes">${icon('info')}</button></div></section>
    <section id="viewport" aria-label="Unobstructed 3D mechanical viewer">
      <div class="loading" id="loading"><img src="./brand/mechscope.svg" alt=""/><strong>Engineering, revealed.</strong><span>Preparing the mechanical studio</span><i></i></div>
    </section>
    <section class="control-dock" aria-label="Playback and camera controls outside the 3D viewer">
      <div class="playback"><button class="play-button" id="play" aria-label="Pause simulation">${icon('pause')}</button><div class="timeline-wrap"><div class="timeline-label"><span id="cycle-label">GAIT CYCLE</span><span id="phase-text">000°</span></div><input id="timeline" type="range" min="0" max="1000" value="0" aria-label="Animation timeline"/></div><button class="speed-button" id="speed" aria-label="Playback speed">1×</button><button class="step-button" id="step" aria-label="Advance animation one step">${icon('next')}</button></div>
      <div class="viewport-tools"><button class="icon-button" id="reset-view" aria-label="Reset camera">${icon('reset')}</button><button class="icon-button" id="camera-view" aria-label="Change camera view">${icon('cube')}</button><button class="icon-button" id="zoom-in" aria-label="Zoom in">${icon('plus')}</button><button class="icon-button" id="zoom-out" aria-label="Zoom out">${icon('minus')}</button><button class="icon-button" id="focus-mode" aria-label="Immersive viewer">${icon('expand')}</button></div>
    </section>
    <div class="studio-status"><span class="live-badge"><i></i><span id="run-label">LIVE KINEMATICS</span></span><span id="viewer-hint">DRAG TO ORBIT · PINCH TO ZOOM</span><span class="view-label" id="view-label">PERSPECTIVE / 01</span></div>
    <section id="mode-panel" class="mode-panel" aria-live="polite"></section>
    <nav class="mode-nav" aria-label="Viewer mode">${modeItems.map(([id, ico, label]) => `<button data-mode="${id}" class="${id === 'explore' ? 'active' : ''}" aria-pressed="${id === 'explore'}">${icon(ico)}<span>${label}</span></button>`).join('')}</nav>
  </main>
  <div id="sheet-root"></div><div id="onboard-root"></div><div id="toast" role="status"></div>
`;
let spider, stage, current = sampleSpider(0), last = 0, uiElapsed = 0, fpsTime = 0, fpsFrames = 0, measuredFps = 0, cameraIndex = 0;
let sheetOpen = false, onboarding = false, pageActive = true, switching = false;
let needsRender = true;
const requestRender = () => { needsRender = true; };
document.addEventListener('pointerdown', requestRender, { passive: true });
document.addEventListener('input', requestRender, { passive: true });
document.addEventListener('click', requestRender, { passive: true });
let lastFocus = null, graphicsEvents;
function bridge(action, data = {}) {
  if (window.NativeBridge?.postMessage) window.NativeBridge.postMessage(JSON.stringify({ action, ...data }));
  else if (action === 'share') {
    if (navigator.share) navigator.share({ title: 'MechScope 3D: How It Works', text: 'Discover intricate machines and biomechanical creatures in MechScope 3D, the interactive mechanical anatomy studio by F7 Developer.' }).catch(() => {});
    else toast('Sharing is available in the Android app.');
  } else if (action === 'purchase' || action === 'restore') toast('Google Play purchases require the Android app installed from a configured Play test track.');
  else if (action === 'rate') toast('The store listing will be available after Google Play publication.');
  else if (action === 'rewarded') toast('Rewarded ads are only available in the Android build, with consent and a connection.');
  else if (action === 'privacy' || action === 'consent') toast('The browser edition does not request ads or collect analytics.');
}
function persist() { localStorage.setItem('mechscope.preferences', JSON.stringify({ theme: state.theme, quality: state.quality, reduced: state.reduced })); }
function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 4600);
}
function applyTheme() {
  const dark = state.theme === 'dark' || (state.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.classList.toggle('reduced-motion', state.reduced);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#182329' : '#f1f2ee';
  stage?.setTheme(dark); bridge('theme', { value: state.theme }); persist();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
function setPlaying(value) {
  requestRender();
  state.playing = value;
  $('#play').innerHTML = icon(value ? 'pause' : 'play');
  $('#play').setAttribute('aria-label', value ? 'Pause simulation' : 'Play simulation');
  $('#run-label').textContent = value ? 'LIVE KINEMATICS' : 'MOTION PAUSED';
  $('.live-badge').classList.toggle('paused', !value);
}
function surfaceButtons() {
  return `<div class="surface-toggle" role="group" aria-label="Material view">${[['solid','cube','Solid'],['xray','eye','X-ray'],['cutaway','scan','Section']].map(([id, ico, text]) => `<button data-surface="${id}" class="${state.surface === id ? 'active' : ''}" aria-pressed="${state.surface === id}">${icon(ico)}${text}</button>`).join('')}</div>`;
}
function metricText() {
  return Object.entries(current.metrics || {}).filter(([, value]) => typeof value === 'number').slice(0, 3).map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').toUpperCase()} ${value.toFixed(Math.abs(value) < 10 ? 2 : 1)}`).join(' · ');
}
function renderPanel() {
  $('#machine-name').textContent = mechanism.title;
  $('#machine-family').textContent = `${mechanism.family.toUpperCase()} · ${mechanism.collection} / ${String(MECHANISMS.length).padStart(3, '0')}`;
  $('#cycle-label').textContent = mechanism.cycleLabel;
  const p = $('#mode-panel');
  p.className = `mode-panel panel-${state.mode}`;
  if (state.mode === 'explore') p.innerHTML = `<div class="explore-heading"><button class="text-button" id="explore-anatomy">Explore anatomy ${icon('arrow')}</button></div><div class="spec-row">${mechanism.specs.map(s => `<div><strong>${s.value}</strong><span>${s.label}</span></div>`).join('')}<div><strong id="part-count">—</strong><span>PARTS</span></div><div class="fps-spec"><strong id="fps">—</strong><span>MEASURED FPS</span></div></div>`;
  if (state.mode === 'anatomy') p.innerHTML = `<div class="panel-heading"><div><span class="eyebrow">LOOK BENEATH THE SURFACE</span><h2>Every part has a purpose.</h2></div><button class="text-button" id="browse-parts">Part index ${icon('arrow')}</button></div>${surfaceButtons()}<p class="panel-help">Tap any component to reveal its name, role and mechanism.</p>`;
  if (state.mode === 'explode') p.innerHTML = `<div class="panel-heading"><div><span class="eyebrow">ASSEMBLY EXPLORER</span><h2>Understand it. Layer by layer.</h2></div><span class="mono value-label" id="explode-value">${Math.round(state.explodeTarget * 100)}%</span></div><div class="explosion-slider"><span>ASSEMBLED</span><input id="explode-range" type="range" min="0" max="100" value="${state.explodeTarget * 100}" aria-label="Assembly separation"/><span>EXPLODED</span></div><div class="panel-footer">${surfaceButtons()}<button class="text-button" id="assemble">Reassemble ${icon('reset')}</button></div>`;
  if (state.mode === 'learn') {
    const l = LESSONS[state.lesson];
    p.innerHTML = `<div class="lesson-top"><span class="eyebrow">HOW IT WORKS <b>${String(state.lesson + 1).padStart(2, '0')} / 05</b></span><div class="lesson-dots">${LESSONS.map((_, i) => `<button data-lesson="${i}" class="${i === state.lesson ? 'active' : ''}" aria-label="Lesson ${i + 1}"></button>`).join('')}</div></div><div class="lesson-main"><div><h2>${l.title}</h2><p>${l.text}</p></div><button class="round-next" id="next-lesson" aria-label="Next lesson">${icon('arrow')}</button></div><div class="lesson-fact">${icon('info')}<span>${l.fact}</span></div>`;
  }
  if (state.mode === 'simulate') p.innerHTML = `<div class="simulation-heading"><span class="eyebrow">LIVE MECHANISM INPUTS</span><button class="text-button" id="sim-reset">Reset ${icon('reset')}</button></div><div class="sim-sliders">${mechanism.controls.map(({ key, label, min, max, step, unit, precision }) => `<label><span>${label}<output id="value-${key}">${state.input[key].toFixed(precision)} ${unit}</output></span><input data-input="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${state.input[key]}" aria-label="${label}"/></label>`).join('')}</div>${current.legs?.some(l => typeof l.stance === 'boolean') ? `<div class="sim-bottom"><div id="contact-chips" class="contact-chips">${current.legs.filter(l => typeof l.stance === 'boolean').map(l => `<span data-leg="${l.id}">${l.id}</span>`).join('')}</div><span class="mono" id="contact-readout"></span>${'direction' in state.input ? `<button class="direction-button" id="direction" aria-label="Reverse gait direction">${state.input.direction === 1 ? 'Forward' : 'Reverse'} ${icon('arrow')}</button>` : ''}</div>` : '<div class="mechanism-metrics" id="mechanism-metrics"></div>'}`;
  $('#explore-anatomy')?.addEventListener('click', () => setMode('anatomy'));
  $('#browse-parts')?.addEventListener('click', showParts);
  all('[data-surface]').forEach(b => b.addEventListener('click', () => { state.surface = b.dataset.surface; renderPanel(); }));
  $('#explode-range')?.addEventListener('input', e => { state.explodeTarget = Number(e.target.value) / 100; $('#explode-value').textContent = `${e.target.value}%`; });
  $('#assemble')?.addEventListener('click', () => { state.explodeTarget = 0; renderPanel(); stage.view('home', state.reduced); });
  all('[data-lesson]').forEach(b => b.addEventListener('click', () => showLesson(Number(b.dataset.lesson))));
  $('#next-lesson')?.addEventListener('click', () => showLesson((state.lesson + 1) % LESSONS.length));
  all('[data-input]').forEach(b => b.addEventListener('input', () => {
    const key = b.dataset.input, val = Number(b.value);
    const previousHz = cycleHz();
    state.input[key] = val; state.t *= previousHz / cycleHz();
    const control = mechanism.controls.find(c => c.key === key);
    $(`#value-${key}`).textContent = `${val.toFixed(control.precision)} ${control.unit}`;
  }));
  $('#sim-reset')?.addEventListener('click', () => { state.input = { ...DEFAULT_INPUT }; state.t = 0; renderPanel(); });
  $('#direction')?.addEventListener('click', () => { state.input.direction *= -1; renderPanel(); });
  updateReadouts();
}
function setMode(mode) {
  if (!modeItems.some(m => m[0] === mode)) return;
  requestRender();
  state.mode = mode; state.selected = null;
  state.explodeTarget = mode === 'explode' ? 0.56 : 0;
  if (mode !== 'anatomy') state.surface = 'solid';
  all('[data-mode]').forEach(b => { b.classList.toggle('active', b.dataset.mode === mode); b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
  $('#viewer-hint').textContent = mode === 'anatomy' ? 'TAP A PART TO REVEAL ITS PURPOSE' : mode === 'simulate' ? 'CONTACT RINGS SHOW GROUNDED FEET' : 'DRAG TO ORBIT · PINCH TO DISCOVER';
  if (mode === 'learn') showLesson(state.lesson);
  else { stage?.view(mode === 'explode' ? 'exploded' : 'home', state.reduced); renderPanel(); }
}
function showLesson(index) {
  state.lesson = index; const l = LESSONS[index];
  state.surface = l.mode; state.explodeTarget = l.explode;
  stage.view(l.view, state.reduced); renderPanel();
}
function updateReadouts() {
  $('#phase-text').textContent = `${String(Math.round(current.phase * 360) % 360).padStart(3, '0')}°`;
  if (document.activeElement !== $('#timeline')) $('#timeline').value = Math.round(current.phase * 1000);
  if ($('#part-count')) $('#part-count').textContent = String(spider?.parts.length || 0);
  if ($('#fps')) $('#fps').textContent = measuredFps ? String(measuredFps) : '—';
  const legs = current.legs || [];
  if ($('#contact-readout')) $('#contact-readout').textContent = `${legs.filter(l => l.stance).length} / ${legs.length} CONTACT`;
  all('[data-leg]').forEach(el => el.classList.toggle('grounded', legs.find(l => l.id === el.dataset.leg)?.stance));
  if ($('#mechanism-metrics')) $('#mechanism-metrics').textContent = metricText();
  if ($('#part-live')) {
    const l = legs.find(l => l.joints && state.selected?.startsWith(l.id + '.'));
    $('#part-live').textContent = l?.actuatorLength != null ? `HIP ${(l.joints.hip * 180 / Math.PI).toFixed(1)}°   KNEE ${(l.joints.knee * 180 / Math.PI).toFixed(1)}°   ACTUATOR ${(l.actuatorLength * 1000).toFixed(0)} mm` : metricText();
  }
}
function sheet(title, content, cls = '') {
  lastFocus = document.activeElement;
  $('#sheet-root').innerHTML = `<div class="sheet-backdrop"></div><section class="sheet ${cls}" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><header><h2 id="sheet-title">${title}</h2><button class="icon-button" id="close-sheet" aria-label="Close dialog">${icon('close')}</button></header><div class="sheet-content">${content}</div></section>`;
  sheetOpen = true;
  $('#close-sheet').addEventListener('click', closeSheet);
  $('.sheet-backdrop').addEventListener('click', closeSheet);
  $('#close-sheet').focus({ preventScroll: true });
}
function closeSheet() { $('#sheet-root').innerHTML = ''; sheetOpen = false; lastFocus?.focus({ preventScroll: true }); }
function showPart(id) {
  const part = spider.parts.find(p => p.id === id);
  if (!part) return;
  state.selected = id; requestRender();
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
  sheet(esc(part.name), `<div class="part-meta"><span>${esc(part.system || 'MECHANICAL ASSEMBLY')}</span><span class="mono">${esc(id)}</span></div><div class="part-description"><h3>Its purpose</h3><p>${esc(part.function || part.description)}</p><h3>How it works</h3><p>${esc(part.how || part.detail)}</p></div><div class="material-line">${icon('cube')}<span>${esc(part.material || 'Engineered mechanical assembly')}</span></div><div class="live-readout"><span class="eyebrow">LIVE MECHANISM STATE</span><p id="part-live" class="mono"></p></div><div class="part-actions"><button class="primary-button" id="inspect-part">Inspect in 3D ${icon('focus')}</button><button class="secondary-button" id="part-xray">${icon('eye')} X-ray</button></div>`, 'part-sheet');
  $('#inspect-part').addEventListener('click', () => { closeSheet(); stage.view(id.startsWith('L') || id.startsWith('R') ? 'detail' : 'top', state.reduced); toast(`${part.name} highlighted. Drag or pinch to inspect.`); });
  $('#part-xray').addEventListener('click', () => { state.surface = 'xray'; closeSheet(); renderPanel(); });
  updateReadouts();
}
function showParts() {
  sheet('Component index', `<label class="search-field">${icon('search')}<input id="part-search" type="search" placeholder="Search parts, materials or systems" aria-label="Search components"/></label><div class="index-summary"><span>${spider.parts.length} SELECTABLE COMPONENTS</span><span>${mechanism.title}</span></div><div id="part-list" class="part-list"></div>`);
  function search() {
    const q = $('#part-search').value.trim().toLowerCase();
    const filtered = spider.parts.filter(p => `${p.name} ${p.system} ${p.material} ${p.id}`.toLowerCase().includes(q));
    const list = $('#part-list'); list.replaceChildren();
    if (!filtered.length) { const msg = document.createElement('p'); msg.textContent = 'No matching components. Try “bearing”, “piston” or “L1”.'; list.append(msg); }
    for (const p of filtered) {
      const btn = document.createElement('button'); btn.className = 'part-row';
      const text = document.createElement('span'), name = document.createElement('strong'), sub = document.createElement('small');
      name.textContent = p.name; sub.textContent = `${p.id} · ${p.system || 'Assembly'}`; text.append(name, sub); btn.append(text);
      btn.insertAdjacentHTML('beforeend', icon('chevron')); btn.addEventListener('click', () => showPart(p.id)); list.append(btn);
    }
  }
  $('#part-search').addEventListener('input', search); search();
}
function showSettings() {
  sheet('Make it yours.', `<div class="settings-intro"><span class="eyebrow">YOUR MECHANICAL STUDIO</span><p>Built for curiosity. Tuned for your device.</p></div><div class="setting-section"><label>Appearance</label><div class="choice-row" id="theme-choices">${['light','dark','system'].map(t => `<button data-theme-choice="${t}" class="${state.theme === t ? 'active' : ''}">${t === 'light' ? icon('sun') : t === 'dark' ? icon('moon') : icon('settings')}${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div><div class="setting-section"><label>Rendering quality</label><div class="choice-row">${['low','balanced','high'].map(t => `<button data-quality-choice="${t}" class="${state.quality === t ? 'active' : ''}">${t === 'low' ? 'Efficient' : t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div><p class="setting-note">All modes keep screen-resolution sharpness. Efficient reduces micro-detail and shadow cost; Balanced adds brushed-metal texture, and High adds finer geometry and shadows. Joint accuracy is unchanged.</p></div><button class="setting-row" id="reduce-motion"><span>${icon('motion')}<span>Reduce interface motion</span></span><span class="switch ${state.reduced ? 'on' : ''}" role="switch" aria-checked="${state.reduced}" aria-label="Reduce interface motion"></span></button><div class="premium-card"><div><span class="eyebrow">UNINTERRUPTED CURIOSITY</span><h3>${state.native.adsRemoved ? 'Your studio. Ad-free.' : 'Remove ads. Keep exploring.'}</h3><p>One purchase. Every mechanism. No subscription.</p></div><button class="primary-button" id="purchase">${state.native.adsRemoved ? 'Ads removed' : state.native.price ? `Remove ads · ${state.native.price}` : 'Remove ads · Check price'}${icon('arrow')}</button><small>${state.native.billingAvailable ? 'Price and availability supplied by Google Play.' : 'Target US price $4.99. Availability requires a configured Google Play release.'}</small><button class="text-button" id="restore">Restore purchases</button></div><div class="settings-links"><button id="privacy">${icon('shield')} Privacy & ad choices ${icon('chevron')}</button><button id="share">${icon('share')} Share MechScope ${icon('chevron')}</button><button id="rate">${icon('star')} Rate the app ${icon('chevron')}</button><button id="replay-onboarding">${icon('explore')} Replay introduction ${icon('chevron')}</button><button id="about">${icon('info')} About & acknowledgements ${icon('chevron')}</button></div><p class="build-note">MECHSCOPE 3D · ${state.native.version} · ${state.native.native ? 'ANDROID' : 'BROWSER'}${state.native.adMode === 'test' ? ' · QA / TEST ADS' : ''}</p>`);
  all('[data-theme-choice]').forEach(b => b.addEventListener('click', () => { state.theme = b.dataset.themeChoice; applyTheme(); all('[data-theme-choice]').forEach(x => x.classList.toggle('active', x === b)); }));
  all('[data-quality-choice]').forEach(b => b.addEventListener('click', () => { state.quality = b.dataset.qualityChoice; stage.setQuality(state.quality); persist(); all('[data-quality-choice]').forEach(x => x.classList.toggle('active', x === b)); }));
  $('#reduce-motion').addEventListener('click', () => { state.reduced = !state.reduced; applyTheme(); const s = $('#reduce-motion .switch'); s.classList.toggle('on', state.reduced); s.setAttribute('aria-checked', String(state.reduced)); });
  $('#purchase').addEventListener('click', () => state.native.adsRemoved ? toast('Your ad-free entitlement is active.') : bridge('purchase'));
  $('#restore').addEventListener('click', () => bridge('restore'));
  $('#privacy').addEventListener('click', showPrivacy);
  $('#share').addEventListener('click', () => bridge('share'));
  $('#rate').addEventListener('click', () => bridge('rate'));
  $('#about').addEventListener('click', showAbout);
  $('#replay-onboarding').addEventListener('click', () => { closeSheet(); startOnboarding(); });
}
function refreshPurchaseCard() {
  const button = $('#purchase');
  if (!button) return;
  $('.premium-card h3').textContent = state.native.adsRemoved ? 'Your studio. Ad-free.' : 'Remove ads. Keep exploring.';
  button.textContent = state.native.adsRemoved ? 'Ads removed' : state.native.price ? `Remove ads · ${state.native.price}` : 'Remove ads · Check price';
  button.insertAdjacentHTML('beforeend', icon('arrow'));
  $('.premium-card small').textContent = state.native.billingAvailable ? 'Price and availability supplied by Google Play.' : 'Target US price $4.99. Availability requires a configured Google Play release.';
}
function showPrivacy() {
  sheet('Privacy, plainly.', `<div class="prose"><p>The 3D model, lessons and preferences work offline. MechScope does not require an account, access your files, contacts, location, microphone or camera.</p><h3>Advertising</h3><p>On Android, Google Mobile Ads may process device identifiers, ad interactions and diagnostic data according to consent choices and regional rules. Ads are not requested before the consent flow permits them. The QA build uses test ad units.</p><h3>Purchases</h3><p>Google Play handles payments. The app checks ownership of the non-consumable “remove_ads” product and stores its last known entitlement locally for offline use. It does not receive card details.</p><h3>Your choices</h3><p>Theme, rendering quality and introduction progress stay on this device. Reset them with Android’s clear-app-data control. No first-party analytics are included.</p><button class="primary-button" id="ad-choices">Manage ad consent ${icon('shield')}</button></div>`);
  $('#ad-choices').addEventListener('click', () => bridge('consent'));
}
function showAbout() {
  sheet('Engineering, revealed.', `<div class="about-brand"><img src="./brand/mechscope.svg" alt="MechScope logo"/><h3>MechScope 3D</h3><p>HOW IT WORKS</p></div><div class="prose"><p>An interactive mechanical anatomy studio by <strong>F7 Developer</strong>. Explore original conceptual biomechanical creatures alongside V8, Jansen linkage and retractable landing-gear studies adapted from Teardown. These are educational mechanisms, not certified manufactured designs.</p><h3>What is simulated?</h3><p>Foot trajectories, rigid link lengths, joint angles, actuator extension, gear ratio and contact states are calculated live from one shared model. Orbiting, section views, disassembly and component selection are real-time 3D.</p><p>This is an educational kinematic simulation, not a validated dynamics, structural, motor-control or engineering safety model. Forces, friction, collisions and battery life are not predicted.</p><h3>Built on good foundations</h3><p>Primary reference: <strong>Teardown</strong> by elvarofficial, with runtime and review techniques originating from whaleyxbt’s claude-motion. MIT licensed; audited revision a91262ac1109051e014662d42ecb0b7bc1f113b1.</p><p>Renderer: Three.js (MIT). Type: Inter and JetBrains Mono (SIL Open Font License). F7 branding supplied by F7 Developer. No remote 3D assets or stock animations.</p><button class="secondary-button" id="licenses">Read open-source notices</button></div>`);
  $('#licenses').addEventListener('click', async () => {
    const response = await fetch('./licenses.txt');
    if (!response.ok) { toast('License notices could not be loaded.'); return; }
    const text = await response.text();
    sheet('Open-source notices', '<pre id="license-text" class="license-text"></pre>'); $('#license-text').textContent = text;
  });
}
function showMachineInfo() {
  sheet(mechanism.title, `<div class="prose"><span class="eyebrow">FIELD NOTES · COLLECTION ${mechanism.collection}</span><h3>${mechanism.family}</h3><p>${mechanism.description || mechanism.tagline}</p><div class="dimension-grid">${mechanism.specs.map(s => `<div><strong>${s.value}</strong><span>${s.label}</span></div>`).join('')}</div><h3>A conceptual machine</h3><p>Dimensions are internally consistent design parameters, not measurements of a commercial machine. Materials are artistic representations. Parametric parts, joint transforms and numerical readouts share one real-time mechanism state.</p><h3>Understand the mechanism</h3><p>${LESSONS[0].text}</p><p>This is an educational kinematic study, not a validated structural, fluid, aerodynamic or biological simulation.</p><button class="primary-button" id="start-lesson">Discover how it works ${icon('arrow')}</button></div>`);
  $('#start-lesson').addEventListener('click', () => { closeSheet(); setMode('learn'); });
}
function showLibrary() {
  bridge('library');
  sheet('The mechanical collection.', `<span class="eyebrow">${MECHANISMS.length} MACHINES. EVERY DETAIL, ALIVE.</span>${MECHANISMS.map(m => `<button class="collection-card ${m.id === mechanism.id ? 'active' : ''}" data-mechanism="${m.id}" aria-pressed="${m.id === mechanism.id}"><span class="collection-number">${m.collection}</span>${icon('anatomy')}<span><strong>${m.title}</strong><small>${m.family}</small></span>${icon('arrow')}</button>`).join('')}<p class="setting-note">Only the active mechanism occupies graphics memory. Every model and lesson is available offline.</p><button class="secondary-button" id="rewarded">Optional ad · 15-minute ad break</button><p class="setting-note">All models, settings and High quality are always free. Completing this optional ad pauses advertising for 15 minutes in this session. Consent and a connection are required.</p>`);
  all('[data-mechanism]').forEach(button => button.addEventListener('click', () => { closeSheet(); if (button.dataset.mechanism !== mechanism.id) changeMechanism(button.dataset.mechanism).catch(showLoadError); }));
  $('#rewarded').addEventListener('click', () => bridge('rewarded'));
}
function startOnboarding() {
  onboarding = true; let step = 0;
  const steps = [
    ['Curiosity has a new dimension.', 'Meet ARACHNE. Drag the machine above to orbit it, or pinch to get closer. Every detail is real-time 3D.', 'Move around it'],
    ['Look past the surface.', 'X-ray reveals the structure inside. Tap a part to learn its function; Solid restores its machined shell.', 'Reveal its anatomy'],
    ['You are in control.', 'Pause, slow down or scrub one gait cycle. Then change real mechanism inputs in Simulation mode.', 'Start exploring'],
  ];
  function paint() {
    const [title, text, action] = steps[step];
    $('#onboard-root').innerHTML = `<section class="onboarding" aria-label="Interactive introduction"><div class="onboard-top"><span class="eyebrow">WELCOME TO MECHSCOPE <b>0${step + 1} / 03</b></span><button id="skip-onboard">Skip</button></div><h2>${title}</h2><p>${text}</p><button class="primary-button" id="next-onboard">${action} ${icon('arrow')}</button></section>`;
    $('#skip-onboard').addEventListener('click', finish);
    $('#next-onboard').addEventListener('click', () => { step++; if (step === 3) finish(); else { if (step === 1) { setMode('anatomy'); state.surface = 'xray'; } if (step === 2) { setMode('simulate'); setPlaying(false); } paint(); } });
  }
  function finish() { onboarding = false; $('#onboard-root').innerHTML = ''; localStorage.setItem('mechscope.onboarded', '1'); setMode('explore'); setPlaying(true); bridge('ready'); }
  paint();
}

all('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('#settings').addEventListener('click', showSettings);
$('#machine-info').addEventListener('click', showMachineInfo);
$('#library').addEventListener('click', showLibrary);
$('#collection-switch').addEventListener('click', showLibrary);
function shiftMechanism(delta) {
  if (switching) return;
  const index = MECHANISMS.findIndex(m => m.id === mechanism.id);
  const next = MECHANISMS[(index + delta + MECHANISMS.length) % MECHANISMS.length];
  if (next.id === mechanism.id) return;
  changeMechanism(next.id).catch(showLoadError);
}
$('#previous-mechanism').addEventListener('click', () => shiftMechanism(-1));
$('#next-mechanism').addEventListener('click', () => shiftMechanism(1));
$('#play').addEventListener('click', () => setPlaying(!state.playing));
$('#speed').addEventListener('click', () => { const speeds = [1, 0.5, 0.25, 2]; state.speed = speeds[(speeds.indexOf(state.speed) + 1) % speeds.length]; $('#speed').textContent = `${state.speed}×`; });
$('#step').addEventListener('click', () => { setPlaying(false); state.t += 1 / (36 * cycleHz()); });
$('#timeline').addEventListener('input', e => { setPlaying(false); state.t = Number(e.target.value) / (1000 * cycleHz()); });
$('#reset-view').addEventListener('click', () => { state.selected = null; stage.view(state.mode === 'explode' ? 'exploded' : 'home', state.reduced); });
$('#camera-view').addEventListener('click', () => { const views = ['home','side','top','front','detail']; cameraIndex = (cameraIndex + 1) % views.length; stage.view(views[cameraIndex], state.reduced); $('#view-label').textContent = `${views[cameraIndex].toUpperCase()} / 0${cameraIndex + 1}`; });
$('#zoom-in').addEventListener('click', () => stage.zoom(0.8));
$('#zoom-out').addEventListener('click', () => stage.zoom(1.25));
$('#focus-mode').addEventListener('click', () => { app.classList.toggle('immersive'); $('#focus-mode').setAttribute('aria-label', app.classList.contains('immersive') ? 'Exit immersive viewer' : 'Immersive viewer'); });
function handleBack() {
  if (sheetOpen) closeSheet();
  else if (onboarding) { $('#onboard-root').innerHTML = ''; onboarding = false; bridge('ready'); }
  else if (app.classList.contains('immersive')) app.classList.remove('immersive');
  else if (state.mode !== 'explore') setMode('explore');
  else bridge('exit');
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { handleBack(); return; }
  if (sheetOpen && e.key === 'Tab') {
    const focusables = all('.sheet button,.sheet input,.sheet a,.sheet [tabindex="0"]');
    if (!focusables.length) return;
    if (e.shiftKey && document.activeElement === focusables[0]) { e.preventDefault(); focusables.at(-1).focus(); }
    if (!e.shiftKey && document.activeElement === focusables.at(-1)) { e.preventDefault(); focusables[0].focus(); }
  }
  if (e.code === 'Space' && !['INPUT','BUTTON'].includes(document.activeElement.tagName)) { e.preventDefault(); setPlaying(!state.playing); }
});
window.addEventListener('mechscope:native', e => {
  const detail = e.detail;
  if (detail?.type === 'state') { Object.assign(state.native, detail); refreshPurchaseCard(); }
  if (detail?.type === 'notice') toast(detail.message);
  if (detail?.type === 'reward' && detail.granted) { closeSheet(); toast('Your 15-minute ad break has started. All settings stay unchanged.'); }
  if (detail?.type === 'back') handleBack();
  if (detail?.type === 'lifecycle') { pageActive = detail.state === 'resume'; last = performance.now(); }
});
document.addEventListener('visibilitychange', () => { pageActive = !document.hidden; last = performance.now(); });
window.addEventListener('pagehide', () => { pageActive = false; });
window.addEventListener('pageshow', () => { pageActive = true; last = performance.now(); });
applyTheme(); renderPanel();

async function changeMechanism(id) {
  if (switching) return;
  const next = MECHANISMS.find(m => m.id === id);
  if (!next) throw new Error('Unknown mechanism');
  switching = true;
  try {
    if (!$('#loading')) $('#viewport').insertAdjacentHTML('beforeend', '<div class="loading" id="loading"><strong>Preparing your mechanism…</strong><span>Building the mechanical anatomy</span><i></i></div>');
    const model = await next.createModel();
    if (HOME_VIEWS[next.id]) model.views = { ...(model.views || {}), ...HOME_VIEWS[next.id] };
    const pose = next.sample(0, next.defaultInputs);
    model.update(pose, { explode: 0, mode: 'solid', selectedId: null, quality: state.quality });
    graphicsEvents?.abort(); stage?.dispose(); spider?.dispose();
    mechanism = next; spider = model; current = pose;
    ({ sample: sampleSpider, defaultInputs: DEFAULT_INPUT, lessons: LESSONS } = next);
    Object.assign(state, { t: 0, explode: 0, explodeTarget: 0, selected: null, lesson: 0, surface: 'solid', input: { ...DEFAULT_INPUT } });
    cameraIndex = 0; $('#view-label').textContent = 'PERSPECTIVE / 01';
    stage = createStage($('#viewport'), spider, showPart, requestRender);
    stage.setQuality(state.quality); applyTheme(); setMode('explore');
    stage.renderer.domElement.setAttribute('aria-label', `${mechanism.title}. Drag to orbit. Pinch or scroll to zoom. Tap a component to inspect it.`);
    await stage.warm();
    graphicsEvents = new AbortController();
    stage.renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); pageActive = false; toast('The graphics context was interrupted. Restoring the viewer…'); }, { signal: graphicsEvents.signal });
    stage.renderer.domElement.addEventListener('webglcontextrestored', () => { pageActive = true; last = performance.now(); requestRender(); }, { signal: graphicsEvents.signal });
    $('#loading')?.remove();
    fpsTime = 0; fpsFrames = 0; measuredFps = 0; last = performance.now(); requestRender();
  } finally { switching = false; }
}
function showLoadError(error) {
  console.error(error);
  if (!$('#loading')) $('#viewport').insertAdjacentHTML('beforeend', '<div class="loading" id="loading"></div>');
  $('#loading').innerHTML = '<strong>The studio could not start.</strong><span>Android System WebView with WebGL 2 is required.</span><button class="primary-button" id="reload">Try again</button>';
  $('#reload').addEventListener('click', () => location.reload());
}
async function start() {
  try {
    await changeMechanism(MECHANISMS[0].id);
    if (localStorage.getItem('mechscope.onboarded') !== '1') startOnboarding(); else bridge('ready');
    requestAnimationFrame(frame);
    window.__mechscope = {
      get state() { return { ...state, mechanismId: mechanism.id, switching, input: { ...state.input } }; },
      get sample() { return current; },
      get diagnostics() { return { ...spider.stats, fps: measuredFps, calls: stage.renderer.info.render.calls, submittedTriangles: stage.renderer.info.render.triangles, geometries: stage.renderer.info.memory.geometries, textures: stage.renderer.info.memory.textures, parts: spider.parts.length, quality: state.quality, pixelRatio: stage.renderer.getPixelRatio(), displayPixelRatio: window.devicePixelRatio, renderSize: [stage.renderer.domElement.width, stage.renderer.domElement.height], time: state.t, phase: current.phase }; },
      get parts() { return spider.parts; },
      get stage() { return stage; },
      catalog: MECHANISMS.map(({ id, title }) => ({ id, title })),
      setMode, showPart, changeMechanism,
      seek(t) { setPlaying(false); state.t = t; requestRender(); },
      setPlaying,
    };
  } catch (error) { showLoadError(error); }
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!pageActive || switching) { last = now; return; }
  const elapsed = (now - (last || now)) / 1000;
  const dt = Math.min(elapsed, 0.1); last = now;
  if (!state.playing && !needsRender && !stage.animating && state.explode === state.explodeTarget) return;
  needsRender = false;
  if (state.playing) state.t += dt * state.speed;
  const amount = state.reduced ? 1 : 1 - Math.exp(-dt * 7);
  state.explode += (state.explodeTarget - state.explode) * amount;
  if (Math.abs(state.explode - state.explodeTarget) < 0.0001) state.explode = state.explodeTarget;
  current = sampleSpider(state.t, state.input);
  spider.update(current, { explode: state.explode, mode: state.surface, selectedId: state.selected, highlight: !!state.selected, quality: state.quality });
  stage.render(current, dt, state.mode === 'simulate' || (state.mode === 'learn' && state.lesson === 4), state.explode);
  fpsFrames++; fpsTime += elapsed;
  if (fpsTime >= 1) { measuredFps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; }
  uiElapsed += dt;
  if (uiElapsed > 0.12 || !state.playing) { updateReadouts(); uiElapsed = 0; }
}
start();
