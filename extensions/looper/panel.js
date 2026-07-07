/* Etude extension · panel.js
   Floating control panel. Pure UI: renders state, emits intents via handlers.
   Never touches Web Audio or the video element. Safe to require in node
   (DOM is only used inside mount). */
globalThis.EtudePanel = (() => {
  const I18N = {
    en: { transpose: 'transpose', pitch: 'pitch', speed: 'speed', loop: 'loop',
          set: 'set', temp_loop: 'temporary loop', audio: 'audio & speed',
          save_loop: 'save loop', saved: 'saved loops',
          bypass: 'bypass', reset: 'reset', del: 'delete',
          local_looper: 'open local file', coffee: 'buy me coffee',
          hidden_hint: 'Etude is hidden. Click the puzzle icon in your browser toolbar to bring it back.',
          no_audio: 'Cannot process this audio here. Speed and loop still work.',
          no_engine: 'Pitch engine unavailable. Speed and loop still work.' },
    tr: { transpose: 'transpoze', pitch: 'ince ayar', speed: 'hız', loop: 'döngü',
          set: 'ayarla', temp_loop: 'geçici döngü', audio: 'ses & hız',
          save_loop: 'döngüyü kaydet', saved: 'kayıtlı döngüler',
          bypass: 'bypass', reset: 'sıfırla', del: 'sil',
          local_looper: 'lokal dosya aç', coffee: 'destek ol',
          hidden_hint: 'Etude gizlendi. Geri getirmek için tarayıcı araç çubuğundaki yapboz simgesine tıklayın.',
          no_audio: 'Bu ses burada işlenemiyor. Hız ve döngü çalışmaya devam eder.',
          no_engine: 'Ses motoru kullanılamıyor. Hız ve döngü çalışmaya devam eder.' },
    de: { transpose: 'transponieren', pitch: 'feinstimmung', speed: 'tempo', loop: 'loop',
          set: 'setzen', temp_loop: 'temporärer Loop', audio: 'Audio & Tempo',
          save_loop: 'loop speichern', saved: 'gespeicherte loops',
          bypass: 'Bypass', reset: 'zurücksetzen', del: 'löschen',
          local_looper: 'lokale Datei öffnen', coffee: 'unterstützen',
          hidden_hint: 'Etude ist ausgeblendet. Klicke auf das Puzzle-Symbol in der Symbolleiste, um es zurückzuholen.',
          no_audio: 'Dieser Ton kann hier nicht verarbeitet werden. Tempo und Loop funktionieren weiter.',
          no_engine: 'Audio-Engine nicht verfügbar. Tempo und Loop funktionieren weiter.' }
  };
  // Default language follows the page: YouTube's interface language (<html lang>),
  // then the browser language, then English. A saved manual choice overrides this
  // later via setLang.
  function detectLang() {
    const src = (globalThis.document && document.documentElement.lang) ||
                (globalThis.navigator && navigator.language) || 'en';
    const l = src.slice(0, 2).toLowerCase();
    return I18N[l] ? l : 'en';
  }
  let lang = detectLang();
  const t = k => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;

  // Re-translatable elements: each registered fn re-applies t() when the language changes.
  const trFns = [];
  const trReg = fn => { fn(); trFns.push(fn); };
  const relabel = () => trFns.forEach(fn => fn());

  function formatTime(x) {
    if (x == null || !isFinite(x)) return '--:--';
    const m = Math.floor(x / 60), s = x - m * 60;
    return m + ':' + s.toFixed(1).padStart(4, '0');
  }

  const state = { transpose: 0, cents: 0, speedPct: 100, a: null, b: null,
                  loopOn: false, loops: [], activeLoop: null, status: '', pitchDisabled: false, bypassed: false };
  let H = {};                    // intent handlers
  let root = null, chip = null, langSel = null;
  let prevLoopCount = 0;         // to auto-scroll the list to a newly saved loop

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const emit = (name, ...args) => { if (H[name]) H[name](...args); };

  // First free "Loop N" name, so a fresh save never silently overwrites an existing one.
  function defaultLoopName() {
    const names = new Set(state.loops.map(l => l.name));
    let n = state.loops.length + 1;
    while (names.has('Loop ' + n)) n++;
    return 'Loop ' + n;
  }

  // tiny DOM helper
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function stepRow(labelKey, unit, get, set, step, lo, hi, def) {
    const row = el('div', 'et-row');
    const lab = el('span', 'et-lab');
    trReg(() => lab.textContent = t(labelKey));
    row.appendChild(lab);
    const minus = el('button', 'et-step', '−');
    const vw = el('div', 'et-valwrap');          // value + unit kept together, centered between the buttons
    const val = el('span', 'et-val', '');
    const un = el('span', 'et-unit', unit);
    vw.append(val, un);
    const plus = el('button', 'et-step', '+');
    const rst = el('button', 'et-rst', '↺');    // per-parameter reset, shown only when off default
    trReg(() => rst.title = t('reset'));
    minus.onclick = () => { emit('onOpen'); set(clamp(get() - step, lo, hi)); };
    plus.onclick = () => { emit('onOpen'); set(clamp(get() + step, lo, hi)); };
    rst.onclick = () => { emit('onOpen'); set(def); };
    row.append(minus, vw, plus, rst);
    row._update = () => {
      val.textContent = String(get());
      rst.style.visibility = get() === def ? 'hidden' : 'visible';
    };
    return row;
  }

  const rows = {};
  function mount() {
    if (root) return;
    // launcher chip: rounded square, draggable, closable, opens the panel
    chip = el('div', 'et-chip');
    chip.title = 'Etude';
    const clogo = el('span', 'et-chip-logo', '𝄆𝄇');
    const cx = el('span', 'et-chip-x', '×');
    cx.title = 'Hide Etude';
    chip.append(clogo, cx);
    document.documentElement.appendChild(chip);

    root = el('div', 'et-panel');
    const head = el('div', 'et-head');
    const brandWrap = el('div', 'et-brandwrap');
    const brandLine = el('div', 'et-brandline');
    const brand = el('a', 'et-brand', '𝄆 Étude 𝄇');   // the logo links to the Etude landing page
    brand.href = 'https://onurcelep.github.io/etude/?theme=dark';   // arrive in the Console (dark) identity
    brand.target = '_blank'; brand.rel = 'noopener'; brand.title = 'Etude';
    brandLine.appendChild(brand);
    brandLine.appendChild(el('span', 'et-subapp', 'Looper'));   // Etude is the umbrella; this is the Looper
    brandWrap.appendChild(brandLine);
    const by = el('a', 'et-by', 'by Onur Celep');
    by.href = 'https://onurcelep.github.io'; by.target = '_blank'; by.rel = 'noopener';
    brandWrap.appendChild(by);
    head.appendChild(brandWrap);
    const hctl = el('div', 'et-hctl');
    langSel = el('select', 'et-lang');
    langSel.title = 'Language';
    ['en', 'tr', 'de'].forEach(c => { const o = el('option', null, c.toUpperCase()); o.value = c; langSel.appendChild(o); });
    langSel.value = lang;
    langSel.onchange = () => setLang(langSel.value, true);
    const close = el('button', 'et-x', '×');
    close.onclick = () => root.classList.remove('et-open');
    hctl.append(langSel, close);
    head.appendChild(hctl);
    root.appendChild(head);

    // place the panel next to the chip (above if there is room, else below)
    function positionPanel() {
      const r = chip.getBoundingClientRect();
      const pw = root.offsetWidth || 284, ph = root.offsetHeight || 320;
      let top = r.top - ph - 8;
      if (top < 8) top = r.bottom + 8;
      top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));   // keep fully on screen
      root.style.left = Math.max(8, r.right - pw) + 'px';
      root.style.top = top + 'px';
      root.style.right = 'auto'; root.style.bottom = 'auto';
    }
    function openPanel(on) {
      root.classList.toggle('et-open', on);
      if (root.classList.contains('et-open')) { positionPanel(); updateSbar(); }   // list has layout now
    }

    // drag the panel by its header (ignore the close button and the by-link)
    let drag = null;
    head.onpointerdown = e => {
      if (e.target.closest('.et-hctl') || e.target.closest('a')) return;
      drag = { x: e.clientX - root.offsetLeft, y: e.clientY - root.offsetTop };
      head.setPointerCapture(e.pointerId);
    };
    head.onpointermove = e => {
      if (!drag) return;
      root.style.left = (e.clientX - drag.x) + 'px';
      root.style.top = (e.clientY - drag.y) + 'px';
      root.style.right = 'auto'; root.style.bottom = 'auto';
    };
    head.onpointerup = () => { drag = null; };

    // drag the chip to reposition; a plain click (no drag) opens/closes the panel
    let cdrag = null, cmoved = false;
    chip.onpointerdown = e => {
      if (e.target === cx) return;
      cdrag = { dx: e.clientX - chip.offsetLeft, dy: e.clientY - chip.offsetTop, sx: e.clientX, sy: e.clientY };
      cmoved = false;
      chip.setPointerCapture(e.pointerId);
    };
    chip.onpointermove = e => {
      if (!cdrag) return;
      if (Math.abs(e.clientX - cdrag.sx) + Math.abs(e.clientY - cdrag.sy) > 4) cmoved = true;
      chip.style.left = (e.clientX - cdrag.dx) + 'px';
      chip.style.top = (e.clientY - cdrag.dy) + 'px';
      chip.style.right = 'auto'; chip.style.bottom = 'auto';
      if (root.classList.contains('et-open')) positionPanel();
    };
    chip.onpointerup = () => {
      if (!cdrag) return;
      const wasDrag = cmoved;
      cdrag = null;
      if (wasDrag) emit('onMoveChip', { left: chip.offsetLeft, top: chip.offsetTop });
      else { const opening = !root.classList.contains('et-open'); openPanel(opening); if (opening) emit('onOpen'); }
    };
    chip.onpointercancel = () => { cdrag = null; };
    cx.onpointerdown = e => e.stopPropagation();
    cx.onclick = e => { e.stopPropagation(); emit('onClose'); };

    rows.transpose = stepRow('transpose', 'st',
      () => state.transpose, v => { state.transpose = v; render(); emit('onTranspose', v); }, 1, -12, 12, 0);
    rows.pitch = stepRow('pitch', '¢',
      () => state.cents, v => { state.cents = v; render(); emit('onPitch', v); }, 5, -100, 100, 0);
    rows.speed = stepRow('speed', '%',
      () => state.speedPct, v => { state.speedPct = v; render(); emit('onSpeed', v); }, 5, 25, 175, 100);
    // audio section header with an audio-only reset (transpose/pitch/speed; leaves the loop alone)
    const ahead = el('div', 'et-sechead');
    const alab = el('div', 'et-seclab');
    trReg(() => alab.textContent = t('audio'));
    const audioRst = el('button', 'et-secrst', '↺');
    trReg(() => audioRst.title = t('reset'));
    audioRst.onclick = () => { emit('onOpen'); emit('onResetAudio'); };
    ahead.append(alab, audioRst);
    root.appendChild(ahead);
    root.append(rows.transpose, rows.pitch, rows.speed);

    // bypass: hear the original, unprocessed audio — an audio control, so it sits with the audio params
    const byp = el('label', 'et-byp');
    const bypIn = el('input'); bypIn.type = 'checkbox';
    bypIn.onchange = () => { emit('onOpen'); emit('onBypass', bypIn.checked); };
    const bypLab = el('span');
    trReg(() => bypLab.textContent = t('bypass'));
    byp.append(bypLab, bypIn);
    root.appendChild(byp);

    // loop section: a temporary (working) A-B on top, saved loops in their own section below
    const loop = el('div', 'et-loop');

    // header with a loop-only reset (clears A/B; leaves audio settings alone)
    const lhead = el('div', 'et-sechead');
    const tlab = el('div', 'et-seclab');
    trReg(() => tlab.textContent = t('temp_loop'));
    const loopRst = el('button', 'et-secrst', '↺');
    trReg(() => loopRst.title = t('reset'));
    loopRst.onclick = () => { state.activeLoop = null; emit('onOpen'); emit('onClearLoop'); };
    lhead.append(tlab, loopRst);
    loop.appendChild(lhead);

    // marker strip: A and B capture the current time; segmented like a loop pedal's readout
    const trans = el('div', 'et-transport');
    function marker(letter) {
      const btn = el('button', 'et-mk');
      const k = el('span', 'et-mk-k', letter);
      const val = el('span', 'et-mk-t', '--:--');
      btn.append(k, val);
      return { btn, val };
    }
    const aMk = marker('A'), bMk = marker('B');
    const aBtn = aMk.btn, aVal = aMk.val, bBtn = bMk.btn, bVal = bMk.val;
    trReg(() => { aBtn.title = t('set') + ' A'; bBtn.title = t('set') + ' B'; });
    // editing A or B means the working loop no longer matches a saved one
    aBtn.onclick = () => { state.activeLoop = null; emit('onOpen'); emit('onSetA'); };
    bBtn.onclick = () => { state.activeLoop = null; emit('onOpen'); emit('onSetB'); };
    trans.append(aBtn, bBtn);
    loop.appendChild(trans);

    // action row: loop (primary, colour = state) stretches; save (secondary) tucks beside it
    const acts = el('div', 'et-acts');
    const tog = el('button', 'et-btn et-tog');
    const togGlyph = el('span', 'et-tog-g', '𝄆𝄇');   // repeat barline: the loop, in the brand's own mark
    const togLab = el('span');
    trReg(() => togLab.textContent = t('loop'));       // colour (et-on), not text, shows on/off
    tog.append(togGlyph, togLab);
    tog.onclick = () => { emit('onOpen'); emit('onToggleLoop', !state.loopOn); };
    const saveBtn = el('button', 'et-btn et-savebtn');
    trReg(() => saveBtn.textContent = t('save_loop'));
    saveBtn.onclick = () => {
      if (state.a == null || state.b == null || state.b <= state.a) return;
      state.activeLoop = null;                  // saving commits, then clears A/B for the next loop
      emit('onSaveLoop', defaultLoopName());
    };
    acts.append(tog, saveBtn);
    loop.appendChild(acts);

    // saved loops: their own section, revealed once at least one is saved
    const saved = el('div', 'et-saved');
    const slab = el('div', 'et-seclab');   // "saved loops · N" — count set in render()
    saved.appendChild(slab);
    const list = el('div', 'et-list');
    saved.appendChild(list);
    const sbar = el('div', 'et-sbar');     // custom always-visible, draggable scrollbar thumb
    saved.appendChild(sbar);
    loop.appendChild(saved);
    // wheel/trackpad scroll repositions the thumb; the thumb itself is draggable by pointer
    list.addEventListener('scroll', updateSbar);
    let sdrag = null;
    sbar.addEventListener('pointerdown', e => {
      e.preventDefault();
      sdrag = { y: e.clientY, top: list.scrollTop };
      sbar.setPointerCapture(e.pointerId);
      sbar.classList.add('et-sbar-drag');
    });
    sbar.addEventListener('pointermove', e => {
      if (!sdrag) return;
      const maxTop = list.clientHeight - sbar.offsetHeight;
      const range = list.scrollHeight - list.clientHeight;
      list.scrollTop = sdrag.top + (maxTop > 0 ? ((e.clientY - sdrag.y) / maxTop) * range : 0);
    });
    sbar.addEventListener('pointerup', () => { sdrag = null; sbar.classList.remove('et-sbar-drag'); });

    root.appendChild(loop);

    // footer: open local file (feature) bottom-left, support link bottom-right
    const foot = el('div', 'et-foot');
    const looper = el('a', 'et-feat');
    trReg(() => looper.textContent = '📂 ' + t('local_looper'));
    looper.href = 'https://onurcelep.github.io/etude/looper/?theme=dark';   // match the extension's dark Console look
    looper.target = '_blank'; looper.rel = 'noopener';
    const coffee = el('a', 'et-supportlink');
    trReg(() => coffee.textContent = '☕ ' + t('coffee'));
    coffee.href = 'https://buymeacoffee.com/onurcelep';
    coffee.target = '_blank'; coffee.rel = 'noopener';
    foot.append(looper, coffee);
    root.appendChild(foot);
    const status = el('div', 'et-status', '');
    root.appendChild(status);

    document.documentElement.appendChild(root);

    rows._ab = { aVal, bVal, tog, aBtn, bBtn };
    rows._audioRst = audioRst;
    rows._loopRst = loopRst;
    rows._saveBtn = saveBtn;
    rows._saved = saved;
    rows._slab = slab;
    rows._list = list;
    rows._sbar = sbar;
    rows._status = status;
    rows._byp = bypIn;
    render();
  }

  // size/position the custom scrollbar thumb from the list's scroll metrics
  function updateSbar() {
    const list = rows._list, sbar = rows._sbar;
    if (!list || !sbar) return;
    const ch = list.clientHeight, sh = list.scrollHeight;
    if (sh <= ch + 1) { sbar.style.display = 'none'; return; }   // fits: nothing to scroll
    sbar.style.display = 'block';
    const thumbH = Math.max(22, (ch / sh) * ch);
    const maxTop = ch - thumbH, range = sh - ch;
    sbar.style.height = thumbH + 'px';
    sbar.style.top = (list.offsetTop + (range ? (list.scrollTop / range) * maxTop : 0)) + 'px';
  }

  function render() {
    if (!root) return;
    ['transpose', 'pitch', 'speed'].forEach(k => rows[k]._update());
    rows.transpose.classList.toggle('et-off', state.pitchDisabled);
    rows.pitch.classList.toggle('et-off', state.pitchDisabled);
    // audio reset shows only when a param is off-default
    rows._audioRst.style.visibility = (state.transpose !== 0 || state.cents !== 0 || state.speedPct !== 100) ? 'visible' : 'hidden';
    rows._ab.aVal.textContent = formatTime(state.a);
    rows._ab.bVal.textContent = formatTime(state.b);
    rows._ab.aBtn.classList.toggle('et-set', state.a != null);
    rows._ab.bBtn.classList.toggle('et-set', state.b != null);
    rows._ab.tog.classList.toggle('et-on', state.loopOn);
    // loop reset shows only when there is a loop to clear
    rows._loopRst.style.visibility = (state.a != null || state.b != null || state.loopOn) ? 'visible' : 'hidden';
    const validAB = state.a != null && state.b != null && state.b > state.a;
    rows._saveBtn.disabled = !validAB;
    rows._saved.style.display = state.loops.length ? '' : 'none';
    rows._slab.textContent = t('saved') + (state.loops.length ? ' · ' + state.loops.length : '');
    rows._status.textContent = state.status;
    rows._byp.checked = !!state.bypassed;
    const list = rows._list;
    list.textContent = '';
    state.loops.forEach(l => {
      const isActive = l.name === state.activeLoop;
      // active = this saved loop is loaded; playing = loaded AND the loop is engaged.
      // Toggling loop off drops "playing" but keeps the subtle "loaded" marker.
      const item = el('div', 'et-item' + (isActive ? ' et-active' : '') + (isActive && state.loopOn ? ' et-playing' : ''));
      const play = el('button', 'et-play', '▶');
      play.title = t('loop');
      play.onclick = () => { state.activeLoop = l.name; emit('onOpen'); emit('onApplyLoop', l); render(); };
      const nm = el('input', 'et-nm'); nm.value = l.name; nm.title = l.name;
      nm.onchange = () => {
        const newName = nm.value.trim();
        if (!newName || newName === l.name) { nm.value = l.name; return; }   // empty rename reverts
        if (state.activeLoop === l.name) state.activeLoop = newName;
        emit('onRenameLoop', l.name, newName);
      };
      const rng = el('span', 'et-rng', formatTime(l.a) + '–' + formatTime(l.b));
      const del = el('button', 'et-x', '×');
      del.title = t('del');
      del.onclick = () => { if (state.activeLoop === l.name) state.activeLoop = null; emit('onDeleteLoop', l.name); };
      item.append(play, nm, rng, del);
      list.appendChild(item);
    });
    // a save adds exactly one loop (at the bottom): scroll it into view so it is clearly saved
    if (state.loops.length === prevLoopCount + 1) list.scrollTop = list.scrollHeight;
    prevLoopCount = state.loops.length;
    updateSbar();
  }

  function setVisible(on) {
    if (chip) chip.style.display = on ? '' : 'none';
    if (!on && root) root.classList.remove('et-open');
  }
  function setChipPos(pos) {
    if (!chip || !pos) return;
    chip.style.left = pos.left + 'px';
    chip.style.top = pos.top + 'px';
    chip.style.right = 'auto'; chip.style.bottom = 'auto';
  }
  let toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!globalThis.document) return;
    if (!toastEl) { toastEl = el('div', 'et-toast'); document.documentElement.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('et-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('et-show'), 6000);
  }

  // Switch language: re-apply all static labels and re-render dynamic text.
  // fromUser=true means the person changed the selector, so persist the choice.
  function setLang(code, fromUser) {
    lang = I18N[code] ? code : 'en';
    if (langSel) langSel.value = lang;
    relabel();
    render();
    if (fromUser) emit('onLang', lang);
  }

  return {
    mount, t, formatTime, setVisible, setChipPos, toast, setLang,
    on(handlers) { H = handlers || {}; },
    setState(partial) { Object.assign(state, partial); render(); }
  };
})();
