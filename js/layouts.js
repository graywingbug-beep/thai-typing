/* Thai keyboard layouts (physical key -> Thai character)
 * Kedmanee: TIS 820-2538 / Windows KBDTH0 (verified against xkb + kbdlayout.info)
 * Pattachote: Linux xkeyboard-config "pat" variant (complete & self-consistent)
 * code = KeyboardEvent.code (physical position, independent of OS layout)
 */
(function (global) {
  'use strict';

  // m: main (unshifted), s: shifted, l: latin legend
  const KEDMANEE_ROWS = [
    [
      { code: 'Backquote', m: '_', s: '%', l: '`' },
      { code: 'Digit1', m: 'ๅ', s: '+', l: '1' },
      { code: 'Digit2', m: '/', s: '๑', l: '2' },
      { code: 'Digit3', m: '-', s: '๒', l: '3' },
      { code: 'Digit4', m: 'ภ', s: '๓', l: '4' },
      { code: 'Digit5', m: 'ถ', s: '๔', l: '5' },
      { code: 'Digit6', m: 'ุ', s: 'ู', l: '6' },
      { code: 'Digit7', m: 'ึ', s: '฿', l: '7' },
      { code: 'Digit8', m: 'ค', s: '๕', l: '8' },
      { code: 'Digit9', m: 'ต', s: '๖', l: '9' },
      { code: 'Digit0', m: 'จ', s: '๗', l: '0' },
      { code: 'Minus', m: 'ข', s: '๘', l: '-' },
      { code: 'Equal', m: 'ช', s: '๙', l: '=' },
      { code: 'Backspace', special: 'backspace', label: 'Backspace ⌫' },
    ],
    [
      { code: 'Tab', special: 'tab', label: 'Tab' },
      { code: 'KeyQ', m: 'ๆ', s: '๐', l: 'Q' },
      { code: 'KeyW', m: 'ไ', s: '"', l: 'W' },
      { code: 'KeyE', m: 'ำ', s: 'ฎ', l: 'E' },
      { code: 'KeyR', m: 'พ', s: 'ฑ', l: 'R' },
      { code: 'KeyT', m: 'ะ', s: 'ธ', l: 'T' },
      { code: 'KeyY', m: 'ั', s: 'ํ', l: 'Y' },
      { code: 'KeyU', m: 'ี', s: '๊', l: 'U' },
      { code: 'KeyI', m: 'ร', s: 'ณ', l: 'I' },
      { code: 'KeyO', m: 'น', s: 'ฯ', l: 'O' },
      { code: 'KeyP', m: 'ย', s: 'ญ', l: 'P' },
      { code: 'BracketLeft', m: 'บ', s: 'ฐ', l: '[' },
      { code: 'BracketRight', m: 'ล', s: ',', l: ']' },
      { code: 'Backslash', m: 'ฃ', s: 'ฅ', l: '\\' },
    ],
    [
      { code: 'CapsLock', special: 'caps', label: 'Caps' },
      { code: 'KeyA', m: 'ฟ', s: 'ฤ', l: 'A' },
      { code: 'KeyS', m: 'ห', s: 'ฆ', l: 'S' },
      { code: 'KeyD', m: 'ก', s: 'ฏ', l: 'D' },
      { code: 'KeyF', m: 'ด', s: 'โ', l: 'F' },
      { code: 'KeyG', m: 'เ', s: 'ฌ', l: 'G' },
      { code: 'KeyH', m: '้', s: '็', l: 'H' },
      { code: 'KeyJ', m: '่', s: '๋', l: 'J' },
      { code: 'KeyK', m: 'า', s: 'ษ', l: 'K' },
      { code: 'KeyL', m: 'ส', s: 'ศ', l: 'L' },
      { code: 'Semicolon', m: 'ว', s: 'ซ', l: ';' },
      { code: 'Quote', m: 'ง', s: '.', l: "'" },
      { code: 'Enter', special: 'enter', label: 'Enter ⏎' },
    ],
    [
      { code: 'ShiftLeft', special: 'shift', label: 'Shift' },
      { code: 'KeyZ', m: 'ผ', s: '(', l: 'Z' },
      { code: 'KeyX', m: 'ป', s: ')', l: 'X' },
      { code: 'KeyC', m: 'แ', s: 'ฉ', l: 'C' },
      { code: 'KeyV', m: 'อ', s: 'ฮ', l: 'V' },
      { code: 'KeyB', m: 'ิ', s: 'ฺ', l: 'B' },
      { code: 'KeyN', m: 'ื', s: '์', l: 'N' },
      { code: 'KeyM', m: 'ท', s: '?', l: 'M' },
      { code: 'Comma', m: 'ม', s: 'ฒ', l: ',' },
      { code: 'Period', m: 'ใ', s: 'ฬ', l: '.' },
      { code: 'Slash', m: 'ฝ', s: 'ฦ', l: '/' },
      { code: 'ShiftRight', special: 'shift', label: 'Shift' },
    ],
    [{ code: 'Space', special: 'space', label: '空格' }],
  ];

  const PATTACHOTE_ROWS = [
    [
      { code: 'Backquote', m: '_', s: '฿', l: '`' },
      { code: 'Digit1', m: '=', s: '+', l: '1' },
      { code: 'Digit2', m: '๒', s: '"', l: '2' },
      { code: 'Digit3', m: '๓', s: '/', l: '3' },
      { code: 'Digit4', m: '๔', s: ',', l: '4' },
      { code: 'Digit5', m: '๕', s: '?', l: '5' },
      { code: 'Digit6', m: 'ู', s: 'ุ', l: '6' },
      { code: 'Digit7', m: '๗', s: '_', l: '7' },
      { code: 'Digit8', m: '๘', s: '.', l: '8' },
      { code: 'Digit9', m: '๙', s: '(', l: '9' },
      { code: 'Digit0', m: '๐', s: ')', l: '0' },
      { code: 'Minus', m: '๑', s: '-', l: '-' },
      { code: 'Equal', m: '๖', s: '%', l: '=' },
      { code: 'Backspace', special: 'backspace', label: 'Backspace ⌫' },
    ],
    [
      { code: 'Tab', special: 'tab', label: 'Tab' },
      { code: 'KeyQ', m: '็', s: '๊', l: 'Q' },
      { code: 'KeyW', m: 'ต', s: 'ฤ', l: 'W' },
      { code: 'KeyE', m: 'ย', s: 'ๆ', l: 'E' },
      { code: 'KeyR', m: 'อ', s: 'ญ', l: 'R' },
      { code: 'KeyT', m: 'ร', s: 'ษ', l: 'T' },
      { code: 'KeyY', m: '่', s: 'ึ', l: 'Y' },
      { code: 'KeyU', m: 'ด', s: 'ฝ', l: 'U' },
      { code: 'KeyI', m: 'ม', s: 'ซ', l: 'I' },
      { code: 'KeyO', m: 'ว', s: 'ถ', l: 'O' },
      { code: 'KeyP', m: 'แ', s: 'ฒ', l: 'P' },
      { code: 'BracketLeft', m: 'ใ', s: 'ฯ', l: '[' },
      { code: 'BracketRight', m: 'ฌ', s: 'ฦ', l: ']' },
      { code: 'Backslash', m: 'ๅ', s: 'ํ', l: '\\' },
    ],
    [
      { code: 'CapsLock', special: 'caps', label: 'Caps' },
      { code: 'KeyA', m: '้', s: '๋', l: 'A' },
      { code: 'KeyS', m: 'ท', s: 'ธ', l: 'S' },
      { code: 'KeyD', m: 'ง', s: 'ำ', l: 'D' },
      { code: 'KeyF', m: 'ก', s: 'ณ', l: 'F' },
      { code: 'KeyG', m: 'ั', s: '์', l: 'G' },
      { code: 'KeyH', m: 'ี', s: 'ื', l: 'H' },
      { code: 'KeyJ', m: 'า', s: 'ผ', l: 'J' },
      { code: 'KeyK', m: 'น', s: 'ช', l: 'K' },
      { code: 'KeyL', m: 'เ', s: 'โ', l: 'L' },
      { code: 'Semicolon', m: 'ไ', s: 'ฆ', l: ';' },
      { code: 'Quote', m: 'ข', s: 'ฑ', l: "'" },
      { code: 'Enter', special: 'enter', label: 'Enter ⏎' },
    ],
    [
      { code: 'ShiftLeft', special: 'shift', label: 'Shift' },
      { code: 'KeyZ', m: 'บ', s: 'ฎ', l: 'Z' },
      { code: 'KeyX', m: 'ป', s: 'ฏ', l: 'X' },
      { code: 'KeyC', m: 'ล', s: 'ฐ', l: 'C' },
      { code: 'KeyV', m: 'ห', s: 'ภ', l: 'V' },
      { code: 'KeyB', m: 'ิ', s: 'ฺ', l: 'B' },
      { code: 'KeyN', m: 'ค', s: 'ศ', l: 'N' },
      { code: 'KeyM', m: 'ส', s: 'ฮ', l: 'M' },
      { code: 'Comma', m: 'ะ', s: 'ฟ', l: ',' },
      { code: 'Period', m: 'จ', s: 'ฉ', l: '.' },
      { code: 'Slash', m: 'พ', s: 'ฬ', l: '/' },
      { code: 'ShiftRight', special: 'shift', label: 'Shift' },
    ],
    [{ code: 'Space', special: 'space', label: '空格' }],
  ];

  function buildIndex(rows) {
    const byCode = {};
    const byChar = {}; // char -> [{code, shift}] (main first)
    const byLatin = {}; // uppercase latin -> code
    for (const row of rows) {
      for (const k of row) {
        if (k.special) continue;
        byCode[k.code] = k;
        if (k.m != null) (byChar[k.m] = byChar[k.m] || []).push({ code: k.code, shift: false });
        if (k.s != null) (byChar[k.s] = byChar[k.s] || []).push({ code: k.code, shift: true });
        if (k.l) byLatin[k.l.toUpperCase()] = k.code;
      }
    }
    return { byCode, byChar, byLatin };
  }

  const LAYOUTS = {
    kedmanee: {
      id: 'kedmanee',
      name: 'เกษมณี · Kedmanee（标准）',
      rows: KEDMANEE_ROWS,
    },
    pattachote: {
      id: 'pattachote',
      name: 'ปัตตาโชติ · Pattachote',
      rows: PATTACHOTE_ROWS,
    },
  };
  for (const id of Object.keys(LAYOUTS)) {
    Object.assign(LAYOUTS[id], buildIndex(LAYOUTS[id].rows));
  }

  global.THAI_LAYOUTS = LAYOUTS;
})(window);
