/* Etude extension · engine.js
   The ONLY module that touches Web Audio. Routes a <video> through Signalsmith
   Stretch (live-input mode) for transpose and fine pitch.
   Hard-won rules from the Looper and the spike:
   - createMediaElementSource once per element (WeakMap cache)
   - once routed, audio ONLY flows through the graph: always keep a path to destination
   - resume the AudioContext inside a user gesture before creating the node
   - numberOfInputs: 1 (with 0 the worklet inactive branch crashes)
   - load the worklet from an extension URL: YouTube page CSP blocks blob: worklets */
globalThis.EtudeEngine = (() => {
  const rt = (typeof browser !== 'undefined' ? browser : chrome).runtime;
  const sources = new WeakMap();   // element -> MediaElementAudioSourceNode
  let ctx = null, node = null, source = null, video = null;
  let attached = false, bypassed = false, semis = 0, cents = 0;
  let onDegrade = null;

  const shift = () => semis + cents / 100;
  function schedule() { if (node && attached) node.schedule({ active: true, semitones: shift(), rate: 1 }); }

  function route() {
    if (!source || !ctx) return;
    try { source.disconnect(); } catch (e) {}
    if (node) { try { node.disconnect(); } catch (e) {} }
    if (bypassed || !node) {
      source.connect(ctx.destination);
    } else {
      source.connect(node);
      node.connect(ctx.destination);
    }
  }

  // If the graph sees pure silence while the video is audibly playing, this
  // element cannot be processed here (DRM, or claimed by another extension).
  // Fail soft: auto-bypass so the original audio comes back.
  function checkSilent() {
    if (!attached || bypassed || !video || video.paused || video.muted) return;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    setTimeout(() => {
      const buf = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buf);
      try { source.disconnect(analyser); } catch (e) {}
      if (!attached || !video || video.paused || video.muted) return;
      if (buf.every(x => x === 0)) {
        bypassed = true; route();
        if (onDegrade) onDegrade('silent');
      }
    }, 1200);
  }

  async function attach(v) {
    video = v;
    if (!ctx) ctx = new AudioContext();
    try { await ctx.resume(); } catch (e) {}
    if (!node) {
      try {
        const mod = await import(rt.getURL('signalsmith-stretch.mjs'));
        mod.default.moduleUrl = rt.getURL('signalsmith-worklet.js');
        node = await mod.default(ctx, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
        node.setUpdateInterval(0.25);
      } catch (e) {
        node = null;
        if (onDegrade) onDegrade('worklet');
        return { ok: false, reason: 'worklet' };
      }
    }
    try {
      source = sources.get(v) || ctx.createMediaElementSource(v);
      sources.set(v, source);
    } catch (e) {
      source = null; video = null;
      if (onDegrade) onDegrade('source');
      return { ok: false, reason: 'source' };
    }
    attached = true;
    schedule();
    route();
    checkSilent();
    return { ok: true };
  }

  function detach() {
    attached = false;
    if (source) { try { source.disconnect(); } catch (e) {} }
    if (node) { try { node.schedule({ active: false }); node.disconnect(); } catch (e) {} }
    // An element that ever had a MediaElementSource only sounds through a graph:
    // reconnect it straight to the destination so it keeps playing after detach.
    if (source && ctx) { try { source.connect(ctx.destination); } catch (e) {} }
    semis = 0; cents = 0; bypassed = false;
    source = null; video = null;
  }

  return {
    attach, detach,
    isAttached: () => attached,
    isBypassed: () => bypassed,
    setTranspose(n) { semis = n; schedule(); },
    setPitchCents(c) { cents = c; schedule(); },
    bypass(on) { bypassed = !!on; route(); },
    resume() { if (ctx) ctx.resume().catch(() => {}); },
    set onDegrade(fn) { onDegrade = fn; }
  };
})();
