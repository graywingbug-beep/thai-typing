/* Settings + custom word libraries persisted in localStorage */
(function (global) {
  'use strict';

  const LS_LIBS = 'thaiType.customLibraries.v1';
  const LS_SET = 'thaiType.settings.v1';

  const DEFAULT_SETTINGS = {
    duration: 0,               // minutes, 0 = unlimited
    showEn: true,
    showZh: true,
    audio: 'before',           // before | after | off
    shuffle: true,
    activeLibId: '',
    font: 'looped',            // looped (传统带圈) | loopless (现代无圈)
    ttsEngine: 'auto',         // auto | system | google
  };

  function loadSettings() {
    let s = {};
    try {
      s = JSON.parse(localStorage.getItem(LS_SET) || '{}');
    } catch (e) { /* ignore */ }
    return Object.assign({}, DEFAULT_SETTINGS, s);
  }

  function saveSettings(s) {
    try { localStorage.setItem(LS_SET, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }

  function loadLibs() {
    try {
      const v = JSON.parse(localStorage.getItem(LS_LIBS) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  function saveLibs(libs) {
    try {
      localStorage.setItem(LS_LIBS, JSON.stringify(libs));
      return true;
    } catch (e) {
      alert('保存失败：浏览器存储空间不足（' + e.message + '）');
      return false;
    }
  }

  function uid() {
    return 'lib_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /* Parse uploaded/pasted library text into [{th,en,zh}]
   * Supported formats:
   *   - JSON array: [{"th":"...","en":"...","zh":"..."}] or [["th","en","zh"], ...]
   *   - plain lines: th<TAB>en<TAB>zh  or  th,en,zh  or  th;en;zh  or just th
   */
  const THAI_RE = /[\u0E00-\u0E7F]/;

  function parseLibraryText(text) {
    const out = [];
    const seen = new Set();
    const push = (th, en, zh) => {
      th = (th || '').trim();
      en = (en || '').trim();
      zh = (zh || '').trim();
      if (!th || !THAI_RE.test(th)) return;
      if (th.length > 120) th = th.slice(0, 120);
      if (seen.has(th)) return;
      seen.add(th);
      out.push({ th, en, zh });
    };

    const trimmed = (text || '').replace(/^\uFEFF/, '').trim();
    if (!trimmed) return { words: out, skipped: 0, total: 0 };

    if (trimmed[0] === '[' || trimmed[0] === '{') {
      try {
        let data = JSON.parse(trimmed);
        if (!Array.isArray(data) && typeof data === 'object' && Array.isArray(data.words)) data = data.words;
        if (!Array.isArray(data)) data = [data];
        let total = 0;
        for (const item of data) {
          total++;
          if (Array.isArray(item)) push(item[0], item[1], item[2]);
          else if (item && typeof item === 'object') push(item.th, item.en, item.zh);
        }
        return { words: out, skipped: total - out.length, total };
      } catch (e) { /* fall through to line parsing */ }
    }

    const lines = trimmed.split(/\r?\n/);
    let total = 0;
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;
      total++;
      let parts;
      if (line.indexOf('\t') >= 0) parts = line.split('\t');
      else if (line.indexOf(';') >= 0) parts = line.split(';');
      else if (line.indexOf(',') >= 0) {
        parts = line.split(',');
        if (parts.length > 3) parts = [parts[0], parts[1], parts.slice(2).join(',')];
      } else parts = [line];
      push(parts[0], parts[1], parts[2]);
    }
    return { words: out, skipped: total - out.length, total };
  }

  global.Store = {
    loadSettings, saveSettings, loadLibs, saveLibs, uid, parseLibraryText,
    MAX_WORDS: 1000,
  };
})(window);
