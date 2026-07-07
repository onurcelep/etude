/* Etude extension · loop.js
   A-B loop on a <video> plus named loops persisted per video (chrome.storage.local).
   Pure logic (decide) is separated so it can be tested in node. */
globalThis.EtudeLoop = (() => {
  const store = () => (typeof browser !== 'undefined' ? browser : chrome).storage.local;
  const key = id => 'loops:' + id;
  let video = null, a = null, b = null, enabled = false, onChange = null;

  // Pure: given the playhead and loop state, return the seek target or null.
  // Snap back only when the playhead reaches B. Seeks before A are left alone:
  // the loop re-engages naturally when playback reaches B again.
  function decide(current, a, b, enabled) {
    if (!enabled || a == null || b == null || b <= a) return null;
    if (current >= b) return a;
    return null;
  }

  function changed() { if (onChange) onChange(getState()); }
  function tick() {
    if (!video) return;
    const target = decide(video.currentTime, a, b, enabled);
    if (target != null) video.currentTime = target;
  }

  function watch(v) { unwatch(); video = v; video.addEventListener('timeupdate', tick); }
  function unwatch() { if (video) video.removeEventListener('timeupdate', tick); video = null; }
  function getState() { return { a, b, enabled }; }

  // Storage can throw "Extension context invalidated" after an extension reload;
  // swallow it and degrade to an empty list rather than an uncaught rejection.
  async function list(id) {
    try {
      const o = await store().get(key(id));
      return o[key(id)] || [];
    } catch (e) { return []; }
  }
  async function save(id, name) {
    if (a == null || b == null || b <= a) return list(id);
    const loops = (await list(id)).filter(l => l.name !== name);
    loops.push({ name, a, b });
    try { await store().set({ [key(id)]: loops }); } catch (e) {}
    return loops;
  }
  async function remove(id, name) {
    const loops = (await list(id)).filter(l => l.name !== name);
    try { await store().set({ [key(id)]: loops }); } catch (e) {}
    return loops;
  }
  // Rename in place (keeps list order) so the panel can offer inline renaming.
  async function rename(id, oldName, newName) {
    const loops = (await list(id)).map(l => l.name === oldName ? { name: newName, a: l.a, b: l.b } : l);
    try { await store().set({ [key(id)]: loops }); } catch (e) {}
    return loops;
  }

  return {
    decide, watch, unwatch, getState, list, save, remove, rename,
    setA(t) { a = t; changed(); },
    setB(t) { b = t; changed(); },
    enable(on) { enabled = !!on; changed(); },
    clear() { a = null; b = null; enabled = false; changed(); },
    apply(loop) { a = loop.a; b = loop.b; enabled = true; changed(); },
    set onChange(fn) { onChange = fn; }
  };
})();
