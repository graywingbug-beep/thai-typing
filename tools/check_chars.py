# -*- coding: utf-8 -*-
import io, re

lay = io.open(r"thai-typing\js\layouts.js", encoding="utf-8").read()
chars = set(re.findall(r"m:\s*'([^']*)'", lay)) | set(re.findall(r"s:\s*'([^']*)'", lay))
chars.discard('')
chars.add(' ')

THAI = set(chr(c) for c in range(0x0E00, 0x0E80))

def check(path, label):
    src = io.open(path, encoding="utf-8").read()
    words = re.findall(r'"((?:[^"\\]|\\.)*)"', src)
    bad = {}
    for w in words:
        if not (set(w) & THAI):
            continue
        for ch in w:
            if ch not in chars:
                bad.setdefault(ch, []).append(w)
    if bad:
        print(label, "UNREACHABLE:", {repr(k): v[:3] for k, v in bad.items()})
    else:
        print(label, "OK")

check(r"thai-typing\js\data\phrasebook.js", "phrasebook")
for i in range(1, 6):
    check(r"thai-typing\js\data\words-%d.js" % i, "words-%d" % i)
