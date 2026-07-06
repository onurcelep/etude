/* Etude extension . content.js
   Orchestrator: finds the player video, wires panel intents to engine/loop/speed,
   survives YouTube SPA navigation. UI never talks to audio directly. */
(() => {
  function getVideoId(href) {
    try {
      const u = new URL(href);
      const v = u.searchParams.get('v');
      if (v) return v;
      const m = u.pathname.match(/^\/(shorts|embed)\/([\w-]{6,})/);
      if (m) return m[2];
    } catch (e) {}
    return null;
  }
  globalThis.EtudeContent = { getVideoId };
  if (!globalThis.document) return;              // node tests stop here
  if (globalThis.__etudeExtLoaded) return;
  globalThis.__etudeExtLoaded = true;

  const E = globalThis.EtudeEngine, P = globalThis.EtudePanel, L = globalThis.EtudeLoop;
  const api = (typeof browser !== 'undefined' ? browser : chrome);
  const store = api.storage.local;
  const getVideo = () =>
    document.querySelector('video.html5-main-video') || document.querySelector('video');

  let currentId = null;
  let shown = true, hintShown = false;   // shown: Etude visible on this page (default on, per design A)

  let attaching = null;
  async function ensureEngine() {
    const v = getVideo();
    if (!v) return false;
    E.resume();
    if (E.isAttached()) return true;
    if (!attaching) attaching = E.attach(v).finally(() => { attaching = null; });
    const r = await attaching;
    return r.ok;
  }

  function applySpeed(pct) {
    const v = getVideo();
    if (!v) return;
    v.preservesPitch = true;
    v.playbackRate = pct / 100;
  }

  E.onDegrade = reason => {
    P.setState({
      status: P.t(reason === 'worklet' ? 'no_engine' : 'no_audio'),
      pitchDisabled: reason === 'worklet' || reason === 'source',
      bypassed: reason === 'silent'
    });
  };
  L.onChange = s => P.setState({ a: s.a, b: s.b, loopOn: s.enabled });

  P.on({
    onOpen: () => E.resume(),
    onTranspose: async n => { if (await ensureEngine()) E.setTranspose(n); },
    onPitch: async c => { if (await ensureEngine()) E.setPitchCents(c); },
    onSpeed: pct => applySpeed(pct),
    onSetA: () => { const v = getVideo(); if (v) L.setA(v.currentTime); },
    onSetB: () => { const v = getVideo(); if (v) L.setB(v.currentTime); },
    onToggleLoop: on => L.enable(on),
    onSaveLoop: async name => { if (currentId) P.setState({ loops: await L.save(currentId, name) }); },
    onApplyLoop: l => { L.apply(l); const v = getVideo(); if (v) v.currentTime = l.a; },
    onDeleteLoop: async name => { if (currentId) P.setState({ loops: await L.remove(currentId, name) }); },
    onBypass: on => { E.bypass(on); P.setState({ bypassed: on }); },
    onReset: () => {
      E.setTranspose(0); E.setPitchCents(0); applySpeed(100); L.clear();
      P.setState({ transpose: 0, cents: 0, speedPct: 100, status: '' });
    },
    onMoveChip: pos => { store.set({ etudeChipPos: pos }); },
    onClose: () => {                       // user hid Etude completely
      shown = false;
      store.set({ etudeShown: false });
      P.setVisible(false);
      if (!hintShown) {                    // teach the re-open path once
        hintShown = true;
        store.set({ etudeHintShown: true });
        P.toast(P.t('hidden_hint'));
      }
    }
  });

  // Toolbar icon toggles Etude on this page (background.js relays the click).
  api.runtime.onMessage.addListener(msg => {
    if (!msg || msg.type !== 'etude-toggle') return;
    shown = !shown;
    store.set({ etudeShown: shown });
    P.setVisible(shown);
  });

  // Wait for the player <video> of the current page, then (re)bind.
  function bindWhenReady(id, tries) {
    if (id !== currentId) return;      // stale: a newer navigation happened
    const v = getVideo();
    if (v) { L.watch(v); return; }
    if (tries > 0) setTimeout(() => bindWhenReady(id, tries - 1), 500);
  }

  async function onNavigate() {
    const id = getVideoId(location.href);
    if (id === currentId) return;
    currentId = id;
    E.detach();
    L.unwatch(); L.clear();
    P.setState({ transpose: 0, cents: 0, speedPct: 100, loops: [], status: '', pitchDisabled: false, bypassed: false });
    if (!id) return;
    bindWhenReady(id, 20);
    const loops = await L.list(id);
    if (id !== currentId) return;      // a newer navigation happened while we loaded
    P.setState({ loops });
  }

  window.addEventListener('yt-navigate-finish', onNavigate);
  setInterval(() => {                           // fallback if the event ever changes
    if (getVideoId(location.href) !== currentId) onNavigate();
  }, 1500);

  P.mount();
  // Restore visibility, chip position, and the one-time hint flag.
  // Default shown = true (design A: visible on first visit so musicians discover it).
  Promise.resolve(store.get(['etudeShown', 'etudeChipPos', 'etudeHintShown']))
    .then(s => {
      shown = s.etudeShown !== false;
      hintShown = !!s.etudeHintShown;
      if (s.etudeChipPos) P.setChipPos(s.etudeChipPos);
      P.setVisible(shown);
    })
    .catch(() => P.setVisible(true));
  onNavigate();
})();
