/* Online translation for word-library check/autocomplete
 * Providers (tried in order):
 *   1. translate.googleapis.com gtx endpoint (no key, CORS allowed)
 *   2. api.mymemory.translated.net (no key, CORS allowed; zh uses zh-CN)
 */
(function (global) {
  'use strict';

  function timeout(ms) {
    const c = new AbortController();
    setTimeout(() => c.abort(), ms);
    return c.signal;
  }

  async function viaGoogle(text, from, to) {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + from +
      '&tl=' + to + '&dt=t&q=' + encodeURIComponent(text);
    const r = await fetch(url, { signal: timeout(6000) });
    if (!r.ok) throw new Error('google http ' + r.status);
    const j = await r.json();
    const t = (j && j[0] || []).map((x) => x && x[0]).join('').trim();
    if (!t) throw new Error('google empty');
    return t;
  }

  async function viaMyMemory(text, from, to) {
    const pair = from + '|' + (to === 'zh' ? 'zh-CN' : to);
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) +
      '&langpair=' + pair;
    const r = await fetch(url, { signal: timeout(8000) });
    if (!r.ok) throw new Error('mymemory http ' + r.status);
    const j = await r.json();
    const t = j && j.responseData && j.responseData.translatedText;
    if (!t || /^(MYMEMORY WARNING|INVALID|QUERY LENGTH)/i.test(t)) throw new Error('mymemory bad');
    return t;
  }

  /* translate "hello" -> "สวัสดี" etc. from/to: 'th' | 'en' | 'zh' */
  async function translate(text, from, to) {
    text = (text || '').trim();
    if (!text) return null;
    for (const fn of [viaGoogle, viaMyMemory]) {
      try {
        const t = await fn(text, from, to);
        if (t) return { text: t, by: fn === viaGoogle ? 'google' : 'mymemory' };
      } catch (e) { /* try next provider */ }
    }
    return null;
  }

  /* loose comparison for "user definition vs machine translation" */
  function sameMeaning(a, b) {
    const norm = (s) => String(s || '').toLowerCase()
      .replace(/[（(].*?[)）]/g, '')      // drop parentheses
      .replace(/[.,!?;:'"`${}·/\\|~^]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const A = norm(a), B = norm(b);
    if (!A || !B) return false;
    if (A === B) return true;
    if (A.includes(B) || B.includes(A)) return true;
    const wa = new Set(A.split(' ')), wb = new Set(B.split(' '));
    let hit = 0;
    for (const w of wa) if (wb.has(w) && w.length > 1) hit++;
    return hit >= Math.max(1, Math.ceil(Math.min(wa.size, wb.size) * 0.6));
  }

  global.OnlineTranslate = { translate, sameMeaning };
})(window);
