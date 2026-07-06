/* Etude extension · panel.js
   Floating control panel. Pure UI: renders state, emits intents via handlers.
   Never touches Web Audio or the video element. Safe to require in node
   (DOM is only used inside mount). */
globalThis.EtudePanel = (() => {
  const I18N = {
    en: { transpose: 'transpose', pitch: 'pitch', speed: 'speed', loop: 'loop',
          set: 'set', loop_on: 'loop: on', loop_off: 'loop: off',
          save_loop: 'save loop', loop_name: 'loop name', saved: 'saved loops',
          bypass: 'original audio', reset: 'reset', del: 'delete',
          local_looper: 'Looper for local files', coffee: 'buy me a coffee',
          hidden_hint: 'Etude is hidden. Click the puzzle icon in your browser toolbar to bring it back.',
          no_audio: 'Cannot process this audio here. Speed and loop still work.',
          no_engine: 'Pitch engine unavailable. Speed and loop still work.' },
    tr: { transpose: 'transpoze', pitch: 'ince ayar', speed: 'hız', loop: 'döngü',
          set: 'ayarla', loop_on: 'döngü: açık', loop_off: 'döngü: kapalı',
          save_loop: 'döngüyü kaydet', loop_name: 'döngü adı', saved: 'kayıtlı döngüler',
          bypass: 'orijinal ses', reset: 'sıfırla', del: 'sil',
          local_looper: 'yerel dosyalar için Looper', coffee: 'bana bir kahve ısmarla',
          hidden_hint: 'Etude gizlendi. Geri getirmek için tarayıcı araç çubuğundaki yapboz simgesine tıklayın.',
          no_audio: 'Bu ses burada işlenemiyor. Hız ve döngü çalışmaya devam eder.',
          no_engine: 'Ses motoru kullanılamıyor. Hız ve döngü çalışmaya devam eder.' },
    de: { transpose: 'transponieren', pitch: 'feinstimmung', speed: 'tempo', loop: 'loop',
          set: 'setzen', loop_on: 'loop: an', loop_off: 'loop: aus',
          save_loop: 'loop speichern', loop_name: 'loop-name', saved: 'gespeicherte loops',
          bypass: 'originalton', reset: 'zurücksetzen', del: 'löschen',
          local_looper: 'Looper für lokale Dateien', coffee: 'spendier mir einen Kaffee',
          hidden_hint: 'Etude ist ausgeblendet. Klicke auf das Puzzle-Symbol in der Symbolleiste, um es zurückzuholen.',
          no_audio: 'Dieser Ton kann hier nicht verarbeitet werden. Tempo und Loop funktionieren weiter.',
          no_engine: 'Audio-Engine nicht verfügbar. Tempo und Loop funktionieren weiter.' }
  };
  const lang = (() => {
    const l = (globalThis.navigator && navigator.language || 'en').slice(0, 2).toLowerCase();
    return I18N[l] ? l : 'en';
  })();
  const t = k => (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;

  function formatTime(x) {
    if (x == null || !isFinite(x)) return '--:--';
    const m = Math.floor(x / 60), s = x - m * 60;
    return m + ':' + s.toFixed(1).padStart(4, '0');
  }

  const state = { transpose: 0, cents: 0, speedPct: 100, a: null, b: null,
                  loopOn: false, loops: [], status: '', pitchDisabled: false, bypassed: false };
  let H = {};                    // intent handlers
  let root = null, chip = null;

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const emit = (name, ...args) => { if (H[name]) H[name](...args); };

  // tiny DOM helper
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function stepRow(labelKey, unit, get, set, step, lo, hi, def) {
    const row = el('div', 'et-row');
    row.appendChild(el('span', 'et-lab', t(labelKey)));
    const minus = el('button', 'et-step', '−');
    const val = el('span', 'et-val', '');
    const un = el('span', 'et-unit', unit);
    const plus = el('button', 'et-step', '+');
    const rst = el('button', 'et-rst', '↺');    // per-parameter reset, shown only when off default
    rst.title = t('reset');
    minus.onclick = () => { emit('onOpen'); set(clamp(get() - step, lo, hi)); };
    plus.onclick = () => { emit('onOpen'); set(clamp(get() + step, lo, hi)); };
    rst.onclick = () => { emit('onOpen'); set(def); };
    row.append(minus, val, un, plus, rst);
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
    brandWrap.appendChild(el('span', 'et-brand', '𝄆 ETUDE 𝄇'));
    const by = el('a', 'et-by', 'by Onur Celep');
    by.href = 'https://onurcelep.github.io'; by.target = '_blank'; by.rel = 'noopener';
    brandWrap.appendChild(by);
    head.appendChild(brandWrap);
    const close = el('button', 'et-x', '×');
    close.onclick = () => root.classList.remove('et-open');
    head.appendChild(close);
    root.appendChild(head);

    // place the panel next to the chip (above if there is room, else below)
    function positionPanel() {
      const r = chip.getBoundingClientRect();
      const pw = root.offsetWidth || 264, ph = root.offsetHeight || 320;
      let top = r.top - ph - 8;
      if (top < 8) top = r.bottom + 8;
      top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));   // keep fully on screen
      root.style.left = Math.max(8, r.right - pw) + 'px';
      root.style.top = top + 'px';
      root.style.right = 'auto'; root.style.bottom = 'auto';
    }
    function openPanel(on) {
      root.classList.toggle('et-open', on);
      if (root.classList.contains('et-open')) positionPanel();
    }

    // drag the panel by its header (ignore the close button and the by-link)
    let drag = null;
    head.onpointerdown = e => {
      if (e.target === close || e.target.closest('a')) return;
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
    root.append(rows.transpose, rows.pitch, rows.speed);

    // loop section
    const loop = el('div', 'et-loop');
    const ab = el('div', 'et-ab');
    const aBtn = el('button', 'et-btn', 'A'); const aVal = el('span', 'et-time', '--:--');
    const bBtn = el('button', 'et-btn', 'B'); const bVal = el('span', 'et-time', '--:--');
    const tog = el('button', 'et-btn et-tog', t('loop_off'));
    aBtn.title = t('set') + ' A'; bBtn.title = t('set') + ' B';
    aBtn.onclick = () => { emit('onOpen'); emit('onSetA'); };
    bBtn.onclick = () => { emit('onOpen'); emit('onSetB'); };
    tog.onclick = () => { emit('onOpen'); emit('onToggleLoop', !state.loopOn); };
    ab.append(aBtn, aVal, bBtn, bVal, tog);
    loop.appendChild(ab);

    const saveRow = el('div', 'et-save');
    const nameIn = el('input', 'et-name');
    nameIn.placeholder = t('loop_name');
    const saveBtn = el('button', 'et-btn', t('save_loop'));
    saveBtn.onclick = () => { if (nameIn.value.trim()) { emit('onSaveLoop', nameIn.value.trim()); nameIn.value = ''; } };
    saveRow.append(nameIn, saveBtn);
    loop.appendChild(saveRow);

    const list = el('div', 'et-list');
    loop.appendChild(list);
    root.appendChild(loop);

    // footer: bypass + reset + status
    const foot = el('div', 'et-foot');
    const byp = el('label', 'et-byp');
    const bypIn = el('input'); bypIn.type = 'checkbox';
    bypIn.onchange = () => { emit('onOpen'); emit('onBypass', bypIn.checked); };
    byp.append(bypIn, document.createTextNode(' ' + t('bypass')));
    const reset = el('button', 'et-btn', t('reset'));
    reset.onclick = () => { emit('onOpen'); emit('onReset'); };
    foot.append(byp, reset);
    root.appendChild(foot);
    const status = el('div', 'et-status', '');
    root.appendChild(status);

    // links: the web Looper (for local files) and support
    const links = el('div', 'et-links');
    const looper = el('a', 'et-link', t('local_looper'));
    looper.href = 'https://onurcelep.github.io/etude/looper/';
    looper.target = '_blank'; looper.rel = 'noopener';
    const coffee = el('a', 'et-link', '☕ ' + t('coffee'));
    coffee.href = 'https://buymeacoffee.com/onurcelep';
    coffee.target = '_blank'; coffee.rel = 'noopener';
    links.append(looper, el('span', 'et-dot', '·'), coffee);
    root.appendChild(links);

    document.documentElement.appendChild(root);

    rows._ab = { aVal, bVal, tog };
    rows._list = list;
    rows._status = status;
    rows._byp = bypIn;
    render();
  }

  function render() {
    if (!root) return;
    ['transpose', 'pitch', 'speed'].forEach(k => rows[k]._update());
    rows.transpose.classList.toggle('et-off', state.pitchDisabled);
    rows.pitch.classList.toggle('et-off', state.pitchDisabled);
    rows._ab.aVal.textContent = formatTime(state.a);
    rows._ab.bVal.textContent = formatTime(state.b);
    rows._ab.tog.textContent = state.loopOn ? t('loop_on') : t('loop_off');
    rows._ab.tog.classList.toggle('et-on', state.loopOn);
    rows._status.textContent = state.status;
    rows._byp.checked = !!state.bypassed;
    const list = rows._list;
    list.textContent = '';
    state.loops.forEach(l => {
      const item = el('div', 'et-item');
      const go = el('button', 'et-btn et-go', l.name + ' · ' + formatTime(l.a) + '–' + formatTime(l.b));
      go.onclick = () => { emit('onOpen'); emit('onApplyLoop', l); };
      const del = el('button', 'et-x', '×');
      del.title = t('del');
      del.onclick = () => emit('onDeleteLoop', l.name);
      item.append(go, del);
      list.appendChild(item);
    });
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

  return {
    mount, t, formatTime, setVisible, setChipPos, toast,
    on(handlers) { H = handlers || {}; },
    setState(partial) { Object.assign(state, partial); render(); }
  };
})();
