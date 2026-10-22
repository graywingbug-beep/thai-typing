/* Thai Typing Practice - main application (v2: practice-first UI) */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const LAYOUT_ID = 'kedmanee'; // 固定使用 Kedmanee 标准布局

  /* ---------------- Thai grapheme cluster utils ---------------- */
  const THAI_COMBINING = /[\u0E31\u0E33\u0E34-\u0E3A\u0E47-\u0E4E]/;
  let segmenter = null;
  if (window.Intl && Intl.Segmenter) {
    try { segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' }); } catch (e) { /* ignore */ }
  }
  function splitClusters(str) {
    if (segmenter) {
      const out = [];
      for (const p of segmenter.segment(str)) out.push(p.segment);
      return out;
    }
    const out = [];
    for (const ch of str) {
      if (out.length && THAI_COMBINING.test(ch)) out[out.length - 1] += ch;
      else out.push(ch);
    }
    return out;
  }

  /* ---------------- app state ---------------- */
  const S = {
    settings: Store.loadSettings(),
    customLibs: Store.loadLibs(),
    builtinLibs: [],
    allLibs: [],
    queue: [],
    idx: 0,
    input: '',
    marks: [],          // 'ok' | 'bad' per codepoint of input
    lastErrPos: -1,
    transition: false,
    running: false,
    started: false,
    finished: false,
    paused: false,
    segStartFrozen: false,
    elapsedBase: 0,
    segStart: 0,
    tickId: null,
    stats: { keys: 0, errs: 0, words: 0, chars: 0 },
    vkShift: false,
  };

  function layout() { return THAI_LAYOUTS[LAYOUT_ID]; }

  /* ---------------- builtin libraries ---------------- */
  function initBuiltinLibs() {
    const parts = [];
    for (let i = 1; i <= 5; i++) {
      const p = window['WORDS_PART' + i];
      if (Array.isArray(p)) parts.push(...p);
    }
    const mk = (arr) => arr.map((a) => ({ th: a[0], en: a[1] || '', zh: a[2] || '' }));
    S.builtinLibs = [
      { id: 'default-1000', name: '泰语 1000 常用词', builtin: true, words: mk(parts) },
    ];
    if (Array.isArray(window.PHRASEBOOK) && window.PHRASEBOOK.length) {
      S.builtinLibs.push({
        id: 'phrasebook', name: '游客会话手册（' + window.PHRASEBOOK.length + ' 条）',
        builtin: true, words: mk(window.PHRASEBOOK),
      });
    }
  }

  function refreshAllLibs() {
    S.allLibs = S.builtinLibs.concat(S.customLibs);
    if (!S.allLibs.some((l) => l.id === S.settings.activeLibId)) {
      S.settings.activeLibId = S.allLibs[0].id;
    }
  }

  function activeLib() {
    return S.allLibs.find((l) => l.id === S.settings.activeLibId) || S.allLibs[0];
  }

  /* ---------------- DOM refs ---------------- */
  let el = {};
  function grabEls() {
    el = {
      statsBar: $('statsBar'), statSpeed: $('statSpeed'), statErr: $('statErr'), statAcc: $('statAcc'),
      statTime: $('statTime'), statRemain: $('statRemain'), statProg: $('statProg'),
      practiceArea: $('practiceArea'),
      selLibQuick: $('selLibQuick'),
      btnFont: $('btnFont'), btnSettings: $('btnSettings'),
      modalSettings: $('modalSettings'), btnSetClose: $('btnSetClose'),
      durBtns: document.querySelectorAll('#modalSettings .dur-btn'),
      selAudio: $('selAudio'), selTts: $('selTts'),
      chkEn: $('chkEn'), chkZh: $('chkZh'), chkShuffle: $('chkShuffle'),
      thaiLine: $('thaiLine'), enLine: $('enLine'), zhLine: $('zhLine'),
      inputDisplay: $('inputDisplay'), nextPreview: $('nextPreview'),
      btnSpeak: $('btnSpeak'), btnToggleEn: $('btnToggleEn'), btnToggleZh: $('btnToggleZh'),
      btnSkip: $('btnSkip'), btnPause: $('btnPause'), btnStop: $('btnStop'),
      keyboard: $('keyboard'), kbLayoutName: $('kbLayoutName'), ttsHint: $('ttsHint'),
      modalLib: $('modalLib'), libList: $('libList'), libFile: $('libFile'),
      libPaste: $('libPaste'), libName: $('libName'), btnLibParse: $('btnLibParse'),
      btnLibClose: $('btnLibClose'), libMsg: $('libMsg'),
      libReview: $('libReview'), reviewSummary: $('reviewSummary'), reviewTable: $('reviewTable'),
      reviewProgress: $('reviewProgress'),
      btnAutoFill: $('btnAutoFill'), btnVerify: $('btnVerify'), btnSaveLib: $('btnSaveLib'),
      modalResult: $('modalResult'), resGrid: $('resGrid'), btnBack: $('btnBack'),
      pauseOverlay: $('pauseOverlay'), btnResume: $('btnResume'),
      toast: $('toast'),
    };
  }

  /* ---------------- toast ---------------- */
  let toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2400);
  }

  /* ---------------- session control ---------------- */
  function shuffleArr(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildQueue() {
    S.queue = activeLib().words.slice();
    if (S.settings.shuffle) shuffleArr(S.queue);
    S.idx = 0;
  }

  function stopTiming() {
    if (S.segStart) { S.elapsedBase += performance.now() - S.segStart; S.segStart = 0; }
  }

  function elapsedMs() {
    return S.elapsedBase + (S.segStart ? performance.now() - S.segStart : 0);
  }

  function startTimer() {
    S.started = true;
    S.segStart = performance.now();
    S.tickId = setInterval(tick, 250);
  }

  function tick() {
    if (S.finished || S.paused || document.hidden || !S.started) return;
    const t = elapsedMs();
    if (S.settings.duration > 0 && t >= S.settings.duration * 60000) {
      stopTiming();
      finishSession();
      return;
    }
    updateStats(t);
  }

  /* 开始/重置一轮练习：清空统计，等待第一次按键开始计时 */
  function resetSession(keepQuiet) {
    hideModal(el.modalResult);
    hideModal(el.pauseOverlay);
    S.running = true; S.started = false; S.finished = false; S.paused = false;
    stopTiming();
    if (S.tickId) { clearInterval(S.tickId); S.tickId = null; }
    S.elapsedBase = 0; S.segStart = 0;
    S.stats = { keys: 0, errs: 0, words: 0, chars: 0 };
    S.vkShift = false;
    document.querySelectorAll('.key-shift').forEach((k) => k.classList.remove('active'));
    buildQueue();
    el.btnPause.textContent = '⏸ 暂停';
    loadWord();
    updateStats(0);
    if (!keepQuiet) Sfx.ensure();
  }

  function finishSession() {
    if (S.finished) return;
    S.finished = true;
    stopTiming();
    if (S.tickId) { clearInterval(S.tickId); S.tickId = null; }
    Sfx.sessionEnd();
    const t = Math.max(elapsedMs(), 1);
    const min = t / 60000;
    const acc = S.stats.keys ? Math.round(((S.stats.keys - S.stats.errs) / S.stats.keys) * 1000) / 10 : 100;
    const rows = [
      ['平均速度', (S.stats.words / min).toFixed(1) + ' 词/分'],
      ['字符速度', Math.round(S.stats.chars / min) + ' 字/分'],
      ['完成词数', S.stats.words + ' 个'],
      ['错误字符', S.stats.errs + ' 个'],
      ['正确率', acc + '%'],
      ['总按键', S.stats.keys + ' 次'],
      ['练习用时', fmtTime(t)],
    ];
    if (S.settings.duration > 0) rows.push(['设定时长', S.settings.duration + ' 分钟']);
    el.resGrid.innerHTML = rows.map((r) =>
      '<div class="res-item"><div class="res-label">' + r[0] + '</div><div class="res-value">' + r[1] + '</div></div>'
    ).join('');
    showModal(el.modalResult);
    updateStats();
  }

  function togglePause(force) {
    if (!S.running || S.finished) return;
    S.paused = force !== undefined ? force : !S.paused;
    if (S.paused) {
      stopTiming();
      el.pauseOverlay.hidden = false;
      el.btnPause.textContent = '▶ 继续';
    } else {
      if (S.started) S.segStart = performance.now();
      el.pauseOverlay.hidden = true;
      el.btnPause.textContent = '⏸ 暂停';
    }
  }

  /* 打开词库/设置弹窗时静默暂停计时（不弹「已暂停」框），关闭即恢复 */
  let modalSilentPause = false;
  function pauseForModal() {
    if (!S.running || S.finished) return;
    if (!S.paused) {
      S.paused = true;
      stopTiming();
      modalSilentPause = true;
    } else {
      // 此前已手动暂停：暂时收起暂停框，关闭弹窗后再恢复显示
      el.pauseOverlay.hidden = true;
      modalSilentPause = false;
    }
  }
  function resumeAfterModal() {
    if (!S.running || S.finished) return;
    if (modalSilentPause) {
      S.paused = false;
      if (S.started) S.segStart = performance.now();
      modalSilentPause = false;
    } else if (S.paused) {
      el.pauseOverlay.hidden = false; // 恢复手动暂停的遮罩
    }
  }

  /* ---------------- word flow ---------------- */
  function currentWord() { return S.queue[S.idx]; }

  function loadWord() {
    const w = currentWord();
    if (!w) return;
    S.input = ''; S.marks = []; S.lastErrPos = -1; S.transition = false;
    renderWordLines();
    renderInput();
    updateKeyHighlight();
    const nxt = S.queue[S.idx + 1];
    el.nextPreview.textContent = nxt ? '⏭ ' + nxt.th : '';
    updateStats();
    if (S.settings.audio === 'before') speakCurrent();
  }

  function speakCurrent() {
    const w = currentWord();
    if (w) ThaiTts.speak(w.th, S.settings.ttsEngine);
  }

  function nextWord() {
    S.idx++;
    if (S.idx >= S.queue.length) buildQueue(); // 练完一轮重新洗牌
    loadWord();
  }

  /* 需求5：输错后继续输入，输满整词长度即切换下一个词（不卡住） */
  function feed(ch) {
    if (!S.running || S.finished || S.paused || S.transition) return;
    const w = currentWord();
    if (!w) return;
    const target = w.th;
    const pos = S.input.length;
    if (pos >= target.length) return;
    if (!S.started) startTimer();
    S.stats.keys++;
    const ok = ch === target[pos];
    S.input += ch;
    S.marks.push(ok ? 'ok' : 'bad');
    if (!ok) {
      S.stats.errs++;
      S.lastErrPos = pos;
      Sfx.error();
    }
    renderWordLines();
    renderInput();
    updateStats();
    if (S.input.length >= target.length) {
      S.stats.words++;
      let match = 0;
      for (let i = 0; i < target.length; i++) if (S.input[i] === target[i]) match++;
      S.stats.chars += match;
      S.transition = true;
      if (S.input === target) {
        Sfx.wordDone();
        if (S.settings.audio === 'after') speakCurrent();
      }
      setTimeout(() => { if (!S.finished) nextWord(); }, 130);
    } else {
      updateKeyHighlight();
    }
  }

  function onBackspace() {
    if (!S.running || S.finished || S.paused || S.transition) return;
    if (S.input.length > 0) {
      if (S.lastErrPos === S.input.length - 1) S.lastErrPos = -1;
      S.input = S.input.slice(0, -1);
      S.marks.pop();
      renderWordLines();
      renderInput();
      updateKeyHighlight();
    }
    // 输入栏清空后退格不再返回上一词
  }

  /* ---------------- rendering ---------------- */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function clusterSpans(text, cursor, lastErr) {
    const clusters = splitClusters(text);
    let pos = 0, html = '';
    for (const c of clusters) {
      const start = pos, end = pos + c.length;
      let cls = 'cl';
      if (end <= cursor) cls += ' done';
      if (start <= lastErr && lastErr < end) cls += ' err';
      if (cursor === start || (cursor > start && cursor < end)) cls += ' cur';
      const sp = c === ' ' ? ' sp' : '';
      html += '<span class="' + cls + sp + '">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>';
      pos = end;
    }
    return html;
  }

  function renderWordLines() {
    const w = currentWord();
    if (!w) return;
    el.thaiLine.innerHTML = clusterSpans(w.th, S.input.length, S.lastErrPos);
    el.enLine.textContent = S.settings.showEn ? w.en : '';
    el.enLine.classList.toggle('hidden-line', !S.settings.showEn);
    el.zhLine.textContent = S.settings.showZh ? w.zh : '';
    el.zhLine.classList.toggle('hidden-line', !S.settings.showZh);
  }

  function renderInput() {
    if (!S.input) {
      el.inputDisplay.innerHTML = '<span class="caret"></span><span class="input-hint">在此输入…（物理键盘直接打，或点击下方键盘）</span>';
      return;
    }
    const clusters = splitClusters(S.input);
    let pos = 0, html = '';
    for (const c of clusters) {
      let bad = false;
      for (let i = pos; i < pos + c.length; i++) if (S.marks[i] === 'bad') bad = true;
      html += '<span class="' + (bad ? 'cl bad' : 'cl ok') + (c === ' ' ? ' sp' : '') + '">' +
        (c === ' ' ? '&nbsp;' : esc(c)) + '</span>';
      pos += c.length;
    }
    html += '<span class="caret"></span>';
    el.inputDisplay.innerHTML = html;
  }

  /* ---------------- virtual keyboard ---------------- */
  function buildKeyboard() {
    const lay = layout();
    el.keyboard.innerHTML = '';
    el.kbLayoutName.textContent = lay.name;
    for (const row of lay.rows) {
      const rowEl = document.createElement('div');
      rowEl.className = 'kb-row';
      for (const k of row) {
        const keyEl = document.createElement('div');
        keyEl.className = 'key' + (k.special ? ' key-' + k.special : '');
        keyEl.dataset.code = k.code;
        if (k.special) {
          keyEl.innerHTML = '<span class="k-spec">' + esc(k.special === 'space' ? 'space · 空格' : (k.label || '')) + '</span>';
        } else {
          keyEl.innerHTML =
            (k.s ? '<span class="k-shift">' + esc(k.s) + '</span>' : '') +
            '<span class="k-main">' + esc(k.m) + '</span>' +
            '<span class="k-latin">' + esc(k.l || '') + '</span>';
        }
        keyEl.addEventListener('pointerdown', (ev) => {
          ev.preventDefault();
          onVirtualKey(k);
        });
        rowEl.appendChild(keyEl);
      }
      el.keyboard.appendChild(rowEl);
    }
    updateKeyHighlight();
  }

  function onVirtualKey(k) {
    if (!S.running || S.finished || S.paused) return;
    pressKeyVisual(k.code);
    if (k.special === 'backspace') { onBackspace(); return; }
    if (k.special === 'space') { feed(' '); return; }
    if (k.special === 'shift') {
      S.vkShift = !S.vkShift;
      document.querySelectorAll('.key-shift').forEach((e2) => e2.classList.toggle('active', S.vkShift));
      return;
    }
    if (k.special) return;
    const ch = S.vkShift ? k.s : k.m;
    if (S.vkShift) {
      S.vkShift = false;
      document.querySelectorAll('.key-shift').forEach((e2) => e2.classList.remove('active'));
    }
    if (ch != null) feed(ch);
  }

  function pressKeyVisual(code) {
    const key = el.keyboard.querySelector('[data-code="' + code + '"]');
    if (!key) return;
    key.classList.remove('pressed');
    void key.offsetWidth;
    key.classList.add('pressed');
    setTimeout(() => key.classList.remove('pressed'), 160);
  }

  function updateKeyHighlight() {
    const w = currentWord();
    if (!w) return;
    el.keyboard.querySelectorAll('.key.expected, .key.shift-needed').forEach((k) => {
      k.classList.remove('expected', 'shift-needed');
    });
    const ch = w.th[S.input.length];
    if (ch === undefined) return;
    if (ch === ' ') {
      const sp = el.keyboard.querySelector('[data-code="Space"]');
      if (sp) sp.classList.add('expected');
      return;
    }
    const cand = layout().byChar[ch];
    if (!cand || !cand.length) return;
    const hit = cand[0];
    const key = el.keyboard.querySelector('[data-code="' + hit.code + '"]');
    if (key) key.classList.add('expected');
    if (hit.shift) {
      el.keyboard.querySelectorAll('.key-shift').forEach((s) => s.classList.add('shift-needed'));
    }
  }

  /* ---------------- physical keyboard (fixed Kedmanee mapping) ---------------- */
  document.addEventListener('keydown', (e) => {
    if (anyModalOpen()) {
      if (e.key === 'Escape') { e.preventDefault(); closeTopModal(); }
      return;
    }
    if (!S.running || S.finished) return;
    if (S.paused) {
      if (e.key === 'Escape') { e.preventDefault(); togglePause(false); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Backspace') {
      e.preventDefault();
      pressKeyVisual('Backspace');
      onBackspace();
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); togglePause(true); return; }
    if (e.key === 'Shift' || e.key === 'CapsLock' || e.key === 'Tab' || e.key === 'Enter') return;

    let ch = null;
    if (e.code === 'Space') {
      e.preventDefault();
      pressKeyVisual('Space');
      feed(' ');
      return;
    }
    const k = layout().byCode[e.code];
    if (k) ch = e.shiftKey ? k.s : k.m;
    if (ch == null) return;
    e.preventDefault();
    pressKeyVisual(e.code);
    feed(ch);
  });

  /* ---------------- stats bar ---------------- */
  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function updateStats(t) {
    if (t === undefined) t = elapsedMs();
    const min = t / 60000;
    const wpm = S.started && min > 0.005 ? (S.stats.words / min).toFixed(1) : '0.0';
    const acc = S.stats.keys ? Math.round(((S.stats.keys - S.stats.errs) / S.stats.keys) * 1000) / 10 : 100;
    el.statSpeed.textContent = wpm + ' 词/分';
    el.statErr.textContent = String(S.stats.errs);
    el.statAcc.textContent = acc + '%';
    el.statTime.textContent = fmtTime(t);
    if (S.settings.duration > 0) {
      el.statRemain.textContent = fmtTime(Math.max(0, S.settings.duration * 60000 - t));
    } else {
      el.statRemain.textContent = '不限';
    }
    if (!S.queue.length) { el.statProg.textContent = '--'; return; }
    el.statProg.textContent = S.settings.duration > 0
      ? S.stats.words + ' 词'
      : Math.min(S.idx, S.queue.length) + '/' + S.queue.length;
  }

  /* ---------------- modals ---------------- */
  function showModal(m) { m.hidden = false; }
  function hideModal(m) { m.hidden = true; }
  function anyModalOpen() {
    return !el.modalLib.hidden || !el.modalResult.hidden || !el.pauseOverlay.hidden || !el.modalSettings.hidden;
  }
  function closeTopModal() {
    if (!el.modalSettings.hidden) { closeSettings(); return; }
    if (!el.modalLib.hidden) { closeLib(); return; }
    if (!el.pauseOverlay.hidden) { togglePause(false); return; }
  }

  /* ---------------- settings ---------------- */
  function applyFont() {
    document.body.classList.toggle('font-loopless', S.settings.font === 'loopless');
    document.body.classList.toggle('font-looped', S.settings.font !== 'loopless');
    el.btnFont.textContent = S.settings.font === 'loopless' ? '现代' : '经典';
    el.btnFont.title = S.settings.font === 'loopless' ? '当前：现代（无圈）· 点击切换为经典（带圈）' : '当前：经典（带圈）· 点击切换为现代（无圈）';
  }

  function openSettings() {
    pauseForModal();
    el.durBtns.forEach((b) => b.classList.toggle('active', Number(b.dataset.min) === S.settings.duration));
    el.selAudio.value = S.settings.audio;
    el.selTts.value = S.settings.ttsEngine;
    el.chkEn.checked = S.settings.showEn;
    el.chkZh.checked = S.settings.showZh;
    el.chkShuffle.checked = S.settings.shuffle;
    showModal(el.modalSettings);
  }

  function closeSettings() {
    hideModal(el.modalSettings);
    resumeAfterModal();
  }

  function updateTtsHint() {
    const bad = ThaiSpeech.supported && !ThaiSpeech.hasThaiVoice() &&
      (S.settings.ttsEngine === 'system' || S.settings.ttsEngine === 'auto');
    el.ttsHint.hidden = !bad;
    el.ttsHint.textContent = bad
      ? '⚠ 系统未安装泰语语音包，将自动尝试在线语音（需联网）。若无声：Windows「设置 → 时间和语言 → 语音 → 添加语音 → 泰语」；或使用 Edge / Chrome 浏览器。'
      : '';
  }

  /* ---------------- header library quick switch ---------------- */
  function renderLibQuick() {
    el.selLibQuick.innerHTML = '';
    for (const lib of S.allLibs) {
      const o = document.createElement('option');
      o.value = lib.id;
      o.textContent = lib.name + '（' + lib.words.length + '）';
      el.selLibQuick.appendChild(o);
    }
    el.selLibQuick.value = S.settings.activeLibId;
  }

  /* ---------------- library management ---------------- */
  function renderLibList() {
    refreshAllLibs();
    el.libList.innerHTML = '';
    for (const lib of S.allLibs) {
      const row = document.createElement('div');
      row.className = 'lib-row';
      const isSel = lib.id === S.settings.activeLibId;
      row.innerHTML =
        '<label class="lib-main">' +
        '<input type="radio" name="activelib" value="' + esc(lib.id) + '"' + (isSel ? ' checked' : '') + '>' +
        '<span class="lib-name">' + esc(lib.name) + '</span>' +
        '<span class="lib-count">' + lib.words.length + ' 词</span>' +
        (lib.builtin ? '<span class="lib-badge">内置</span>' : '<span class="lib-badge custom">自建</span>') +
        '</label>' +
        (lib.builtin ? '' : '<button class="lib-del" data-id="' + esc(lib.id) + '">🗑 删除</button>');
      el.libList.appendChild(row);
    }
    el.libList.querySelectorAll('input[name="activelib"]').forEach((r) => {
      r.addEventListener('change', () => {
        S.settings.activeLibId = r.value;
        Store.saveSettings(S.settings);
        renderLibList();
        renderLibQuick();
        resetSession(true);
        toast('已切换词库：' + activeLib().name);
      });
    });
    el.libList.querySelectorAll('.lib-del').forEach((b) => {
      b.addEventListener('click', () => {
        const id = b.dataset.id;
        const lib = S.customLibs.find((l) => l.id === id);
        if (!lib) return;
        if (!confirm('确定删除词库「' + lib.name + '」？此操作不可恢复。')) return;
        S.customLibs = S.customLibs.filter((l) => l.id !== id);
        Store.saveLibs(S.customLibs);
        if (S.settings.activeLibId === id) S.settings.activeLibId = '';
        Store.saveSettings(S.settings);
        renderLibList();
        renderLibQuick();
        resetSession(true);
      });
    });
  }

  /* ---------- 导入核对流程（解析 → 核对/补全/校对 → 保存） ---------- */
  let review = null; // { name, words: [{th,en,zh,autoEn,autoZh,sugEn,sugZh,ok}] }
  const transCache = new Map();

  function cachedTrans(text, from, to) {
    const key = text + '\u0000' + from + '>' + to;
    if (transCache.has(key)) return transCache.get(key);
    const p = OnlineTranslate.translate(text, from, to).catch(() => null);
    transCache.set(key, p);
    return p;
  }

  function parseLibInput() {
    const text = el.libPaste.value.trim();
    if (!text) { el.libMsg.textContent = '❌ 请先粘贴词条内容或选择文件。'; return; }
    const r = Store.parseLibraryText(text);
    if (!r.words.length) { el.libMsg.textContent = '❌ 未解析到有效词条（泰语列必须包含泰文字符）。'; return; }
    startReview(el.libName.value.trim(), r.words, r.skipped);
  }

  async function readFileAsText(file) {
    return new Promise((res, rej) => {
      const rd = new FileReader();
      rd.onload = () => res(rd.result);
      rd.onerror = () => rej(rd.error);
      rd.readAsText(file, 'utf-8');
    });
  }

  function startReview(name, words, skipped) {
    review = {
      name: name || '',
      words: words.map((w) => ({
        th: w.th, en: w.en || '', zh: w.zh || '',
        autoEn: false, autoZh: false, sugEn: null, sugZh: null, checked: false,
      })),
      skipped: skipped || 0,
    };
    el.libReview.hidden = false;
    el.reviewSummary.textContent = '共解析 ' + review.words.length + ' 条' +
      (review.skipped ? '（跳过无效 ' + review.skipped + ' 行）' : '') +
      '，缺释义 ' + review.words.filter((w) => !w.en || !w.zh).length + ' 条';
    renderReviewTable();
    el.libMsg.textContent = '';
  }

  function renderReviewTable() {
    if (!review) return;
    const frag = document.createDocumentFragment();
    review.words.forEach((w, i) => {
      if (i >= Store.MAX_WORDS) return;
      const row = document.createElement('div');
      row.className = 'rv-row';
      row.dataset.i = i;
      row.innerHTML =
        '<span class="rv-th" lang="th">' + esc(w.th) + '</span>' +
        '<input class="rv-en" value="' + esc(w.en) + '" placeholder="英语释义">' +
        '<input class="rv-zh" value="' + esc(w.zh) + '" placeholder="中文释义">' +
        '<span class="rv-status"></span>';
      row.querySelector('.rv-en').addEventListener('input', (e) => { review.words[i].en = e.target.value; review.words[i].sugEn = null; });
      row.querySelector('.rv-zh').addEventListener('input', (e) => { review.words[i].zh = e.target.value; review.words[i].sugZh = null; });
      frag.appendChild(row);
    });
    el.reviewTable.innerHTML = '';
    el.reviewTable.appendChild(frag);
    updateReviewStatus();
  }

  function rowEl(i) { return el.reviewTable.querySelector('.rv-row[data-i="' + i + '"]'); }

  function updateReviewStatus(i) {
    const paint = (idx) => {
      const w = review.words[idx];
      const row = rowEl(idx);
      if (!row) return;
      const st = row.querySelector('.rv-status');
      row.classList.remove('warn', 'auto');
      let html = '';
      if (w.sugEn || w.sugZh) {
        row.classList.add('warn');
        if (w.sugEn) html += '<button class="sug" data-i="' + idx + '" data-lang="en" title="机翻：' + esc(w.sugEn) + '">⚠ en→' + esc(w.sugEn.slice(0, 18)) + '</button>';
        if (w.sugZh) html += '<button class="sug" data-i="' + idx + '" data-lang="zh" title="机翻：' + esc(w.sugZh) + '">⚠ zh→' + esc(w.sugZh.slice(0, 12)) + '</button>';
      } else if (w.checked) {
        html = '<span class="okmark">✓</span>';
      }
      if (w.autoEn || w.autoZh) row.classList.add('auto');
      st.innerHTML = html;
    };
    if (i === undefined) { for (let k = 0; k < review.words.length; k++) paint(k); }
    else paint(i);
  }

  let reviewStop = false;
  async function runReviewPass(mode) { // 'fill' | 'verify'
    if (!review) return;
    reviewStop = false;
    const btn = mode === 'fill' ? el.btnAutoFill : el.btnVerify;
    const other = mode === 'fill' ? el.btnVerify : el.btnAutoFill;
    btn.disabled = true; other.disabled = true;
    el.btnSaveLib.disabled = true;
    let done = 0, changed = 0, warned = 0, failed = 0;
    const total = review.words.length;
    el.reviewProgress.hidden = false;
    for (let i = 0; i < total; i++) {
      if (reviewStop) break;
      const w = review.words[i];
      if (mode === 'fill' && w.en && w.zh) { continue; }
      el.reviewProgress.textContent = '🌐 正在翻译 ' + (i + 1) + '/' + total + '：' + w.th;
      let used = false;
      if (!w.en || mode === 'verify') {
        const r = await cachedTrans(w.th, 'th', 'en');
        if (r) {
          if (!w.en) { w.en = r.text; w.autoEn = true; changed++; used = true; syncInput(i, 'en', r.text); }
          else if (!OnlineTranslate.sameMeaning(w.en, r.text)) { w.sugEn = r.text; warned++; used = true; }
        } else failed++;
      }
      if (!w.zh || mode === 'verify') {
        const r = await cachedTrans(w.th, 'th', 'zh');
        if (r) {
          if (!w.zh) { w.zh = r.text; w.autoZh = true; changed++; used = true; syncInput(i, 'zh', r.text); }
          else if (!OnlineTranslate.sameMeaning(w.zh, r.text)) { w.sugZh = r.text; warned++; used = true; }
        } else failed++;
      }
      if (mode === 'verify' || used) { w.checked = true; }
      updateReviewStatus(i);
      done++;
      if (i % 8 === 7) await new Promise((res) => setTimeout(res, 30));
    }
    el.reviewProgress.hidden = true;
    btn.disabled = false; other.disabled = false;
    el.btnSaveLib.disabled = false;
    el.reviewSummary.textContent = (mode === 'fill' ? '补全' : '校对') + '完成：自动补全 ' + changed + ' 项' +
      (warned ? '，⚠ 差异提示 ' + warned + ' 项' : '') +
      (failed ? '，翻译失败 ' + failed + ' 项（可稍后重试或手动补）' : '') +
      (reviewStop ? '（已手动停止）' : '');
  }

  function syncInput(i, lang, val) {
    const row = rowEl(i);
    if (!row) return;
    const inp = row.querySelector(lang === 'en' ? '.rv-en' : '.rv-zh');
    if (inp) inp.value = val;
  }

  function saveReviewLib() {
    if (!review || !review.words.length) return;
    let words = review.words.map((w) => ({ th: w.th, en: (w.en || '').trim(), zh: (w.zh || '').trim() }))
      .filter((w) => w.th);
    let cut = 0;
    if (words.length > Store.MAX_WORDS) { cut = words.length - Store.MAX_WORDS; words = words.slice(0, Store.MAX_WORDS); }
    let name = review.name.trim() || ('我的词库 ' + new Date().toLocaleDateString('zh-CN'));
    let final = name, n = 2;
    while (S.customLibs.some((l) => l.name === final)) final = name + ' (' + n++ + ')';
    S.customLibs.push({ id: Store.uid(), name: final, builtin: false, words });
    if (!Store.saveLibs(S.customLibs)) return;
    S.settings.activeLibId = S.customLibs[S.customLibs.length - 1].id;
    Store.saveSettings(S.settings);
    renderLibList();
    renderLibQuick();
    el.libMsg.textContent = '✅ 已保存「' + final + '」：' + words.length + ' 词' +
      (cut ? '（超出上限已截取前 ' + Store.MAX_WORDS + ' 条）' : '') + '，并设为当前词库。';
    el.libPaste.value = '';
    el.libName.value = '';
    el.libReview.hidden = true;
    review = null;
    resetSession(true);
    toast('已切换词库：' + final);
  }

  function openLib() {
    pauseForModal();
    renderLibList();
    el.libMsg.textContent = '';
    showModal(el.modalLib);
  }

  function closeLib() {
    hideModal(el.modalLib);
    resumeAfterModal();
  }

  /* ---------------- wire up ---------------- */
  function bindEvents() {
    el.btnSpeak.addEventListener('click', () => { Sfx.ensure(); speakCurrent(); });
    el.btnToggleEn.addEventListener('click', () => {
      S.settings.showEn = !S.settings.showEn;
      el.btnToggleEn.classList.toggle('off', !S.settings.showEn);
      Store.saveSettings(S.settings); renderWordLines();
    });
    el.btnToggleZh.addEventListener('click', () => {
      S.settings.showZh = !S.settings.showZh;
      el.btnToggleZh.classList.toggle('off', !S.settings.showZh);
      Store.saveSettings(S.settings); renderWordLines();
    });
    el.btnSkip.addEventListener('click', () => { if (S.running && !S.transition) nextWord(); });
    el.btnPause.addEventListener('click', () => togglePause());
    el.btnStop.addEventListener('click', () => { togglePause(false); finishSession(); });
    el.btnResume.addEventListener('click', () => togglePause(false));
    el.btnBack.addEventListener('click', () => resetSession()); // 返回练习（新一轮，输入后开始计时）

    // header
    el.selLibQuick.addEventListener('change', () => {
      S.settings.activeLibId = el.selLibQuick.value;
      Store.saveSettings(S.settings);
      resetSession(true);
      toast('已切换词库：' + activeLib().name);
    });
    el.btnFont.addEventListener('click', () => {
      S.settings.font = S.settings.font === 'loopless' ? 'looped' : 'loopless';
      Store.saveSettings(S.settings);
      applyFont();
      toast(S.settings.font === 'loopless' ? '已切换：现代（无圈）字体' : '已切换：经典（带圈）字体');
    });
    el.btnSettings.addEventListener('click', openSettings);
    el.btnSetClose.addEventListener('click', closeSettings);
    el.modalSettings.addEventListener('click', (e) => { if (e.target === el.modalSettings) closeSettings(); });

    el.durBtns.forEach((b) => b.addEventListener('click', () => {
      el.durBtns.forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      S.settings.duration = Number(b.dataset.min);
      Store.saveSettings(S.settings);
      closeSettings();
      resetSession(true);
      toast(S.settings.duration > 0 ? '时长已设为 ' + S.settings.duration + ' 分钟，统计已重置' : '已切换为不限时长，统计已重置');
    }));
    el.selAudio.addEventListener('change', () => { S.settings.audio = el.selAudio.value; Store.saveSettings(S.settings); });
    el.selTts.addEventListener('change', () => {
      S.settings.ttsEngine = el.selTts.value;
      Store.saveSettings(S.settings);
      updateTtsHint();
      speakCurrent();
    });
    el.chkEn.addEventListener('change', () => {
      S.settings.showEn = el.chkEn.checked;
      el.btnToggleEn.classList.toggle('off', !S.settings.showEn);
      Store.saveSettings(S.settings); renderWordLines();
    });
    el.chkZh.addEventListener('change', () => {
      S.settings.showZh = el.chkZh.checked;
      el.btnToggleZh.classList.toggle('off', !S.settings.showZh);
      Store.saveSettings(S.settings); renderWordLines();
    });
    el.chkShuffle.addEventListener('change', () => {
      S.settings.shuffle = el.chkShuffle.checked;
      Store.saveSettings(S.settings);
      closeSettings();
      resetSession(true);
      toast('随机词序已' + (S.settings.shuffle ? '开启' : '关闭') + '，统计已重置');
    });

    // library modal
    document.querySelectorAll('[data-open-lib]').forEach((b) => b.addEventListener('click', openLib));
    el.btnLibClose.addEventListener('click', closeLib);
    el.modalLib.addEventListener('click', (e) => { if (e.target === el.modalLib) closeLib(); });
    el.btnLibParse.addEventListener('click', parseLibInput);
    el.btnAutoFill.addEventListener('click', () => runReviewPass('fill'));
    el.btnVerify.addEventListener('click', () => runReviewPass('verify'));
    el.btnSaveLib.addEventListener('click', saveReviewLib);
    el.reviewTable.addEventListener('click', (e) => {
      const btn = e.target.closest('button.sug');
      if (!btn || !review) return;
      const i = Number(btn.dataset.i), lang = btn.dataset.lang;
      if (lang === 'en' && review.words[i].sugEn) { review.words[i].en = review.words[i].sugEn; review.words[i].sugEn = null; syncInput(i, 'en', review.words[i].en); }
      if (lang === 'zh' && review.words[i].sugZh) { review.words[i].zh = review.words[i].sugZh; review.words[i].sugZh = null; syncInput(i, 'zh', review.words[i].zh); }
      updateReviewStatus(i);
    });
    el.libFile.addEventListener('change', async () => {
      const f = el.libFile.files && el.libFile.files[0];
      if (!f) return;
      try {
        const text = await readFileAsText(f);
        el.libPaste.value = text;
        el.libName.value = el.libName.value.trim() || f.name.replace(/\.[^.]+$/, '');
        el.libMsg.textContent = '文件已读入，点击「解析并核对」。';
      } catch (err) {
        el.libMsg.textContent = '❌ 读取文件失败：' + err.message;
      }
      el.libFile.value = '';
    });

    // auto pause timing when tab hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && S.running && S.started && !S.finished) {
        stopTiming();
        S.segStartFrozen = true;
      } else if (!document.hidden && S.running && !S.finished) {
        if (S.started && !S.paused && S.segStartFrozen) S.segStart = performance.now();
        S.segStartFrozen = false;
      }
    });

    if (ThaiSpeech.supported) {
      window.speechSynthesis.addEventListener('voiceschanged', updateTtsHint);
      setTimeout(updateTtsHint, 800);
    }
  }

  /* ---------------- init ---------------- */
  function init() {
    grabEls();
    initBuiltinLibs();
    refreshAllLibs();
    renderLibQuick();
    buildKeyboard();
    bindEvents();
    applyFont();
    el.btnToggleEn.classList.toggle('off', !S.settings.showEn);
    el.btnToggleZh.classList.toggle('off', !S.settings.showZh);
    updateTtsHint();
    resetSession(true); // 打开即进入练习，第一次按键开始计时
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
