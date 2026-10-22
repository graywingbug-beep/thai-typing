/* Sound effects (WebAudio) + Thai text-to-speech
 * TTS engines:
 *   - system : Web Speech API (pick best Thai voice; online/natural voices first)
 *   - google : Google Translate TTS via <audio> (needs internet, best quality voice)
 *   - auto   : google when online engine requested or no system Thai voice, else system
 */
(function (global) {
  'use strict';

  const Sfx = {
    ctx: null,
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(freq, dur, type, gain, delay) {
      const ctx = this.ensure();
      if (!ctx) return;
      const t0 = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.12, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },
    error() {
      this.tone(196, 0.09, 'square', 0.14);
      this.tone(165, 0.12, 'square', 0.14, 0.1);
    },
    wordDone() {
      this.tone(880, 0.07, 'sine', 0.08);
      this.tone(1174.7, 0.09, 'sine', 0.08, 0.07);
    },
    sessionEnd() {
      this.tone(523.3, 0.12, 'sine', 0.1);
      this.tone(659.3, 0.12, 'sine', 0.1, 0.12);
      this.tone(784, 0.2, 'sine', 0.1, 0.24);
    },
  };

  /* ---------- Google Translate TTS via <audio> ---------- */
  const GoogleTts = {
    el: null,
    okCount: 0, failCount: 0,
    url(text) {
      return 'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=th&q=' +
        encodeURIComponent(text);
    },
    play(text) {
      return new Promise((resolve) => {
        try {
          if (!this.el) {
            this.el = new Audio();
            this.el.preload = 'none';
          }
          const a = this.el;
          let settled = false;
          const done = (ok) => {
            if (settled) return;
            settled = true;
            a.oncanplay = a.onerror = a.onended = null;
            ok ? this.okCount++ : this.failCount++;
            resolve(ok);
          };
          a.oncanplaythrough = () => { done(true); a.play().catch(() => {}); };
          a.onended = () => done(true);
          a.onerror = () => done(false);
          a.src = this.url(text);
          a.load();
          // if it can't even start loading in 4s, treat as unavailable
          setTimeout(() => { if (!settled && a.readyState === 0) done(false); }, 4000);
          a.play().catch(() => { /* wait for canplay */ });
        } catch (e) { resolve(false); }
      });
    },
    stop() { if (this.el) { this.el.pause(); this.el.removeAttribute('src'); } },
    seemsAvailable() { return this.okCount > 0 && this.failCount === 0; },
    seemsDead() { return this.failCount >= 2 && this.okCount === 0; },
  };

  /* ---------- Web Speech API ---------- */
  const Speech = {
    voices: [],
    supported: 'speechSynthesis' in window,
    init() {
      if (!this.supported) return;
      const load = () => { this.voices = window.speechSynthesis.getVoices() || []; };
      load();
      window.speechSynthesis.onvoiceschanged = load;
    },
    thaiVoices() {
      const th = this.voices.filter((v) => /^th([-_]|$)/i.test(v.lang));
      // prefer online / natural voices (Edge: "Microsoft ... Online (Natural)", Chrome: "Google ไทย")
      const score = (v) => {
        const n = v.name || '';
        let s = 0;
        if (/natural/i.test(n)) s += 4;
        if (/online/i.test(n)) s += 3;
        if (/google/i.test(n)) s += 2;
        if (v.localService) s += 1;
        return s;
      };
      return th.sort((a, b) => score(b) - score(a));
    },
    hasThaiVoice() { return this.thaiVoices().length > 0; },
    speakSystem(text) {
      if (!this.supported || !text) return false;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'th-TH';
        u.rate = 0.9;
        const v = this.thaiVoices()[0];
        if (v) u.voice = v;
        window.speechSynthesis.speak(u);
        return true;
      } catch (e) { return false; }
    },
  };

  /* engine: 'auto' | 'system' | 'google' */
  function speak(text, engine) {
    if (!text) return;
    Speech.speakSystem; // keep reference
    GoogleTts.stop();
    if (engine === 'system') { Speech.speakSystem(text); return; }
    if (engine === 'google') { GoogleTts.play(text); return; }
    // auto
    if (GoogleTts.seemsDead()) { Speech.speakSystem(text); return; }
    GoogleTts.play(text).then((ok) => { if (!ok) Speech.speakSystem(text); });
  }

  Speech.init();
  global.Sfx = Sfx;
  global.ThaiSpeech = Speech;
  global.ThaiTts = { speak, GoogleTts };
})(window);
