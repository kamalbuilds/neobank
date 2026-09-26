#!/usr/bin/env python3
"""Turn the grant draft into a browser script that fills the Airtable form.

Retyping long answers by hand is how a paragraph ends up in the wrong question.
This reads the same markdown the draft lives in, so the form and the repo cannot
disagree, and it refuses to emit any answer still carrying an unresolved
[OPEN: ...] note, because those are working notes and not answers.
"""
import json
import re
import sys
from pathlib import Path

SRC = Path("docs/submission/STARKNET_SEED_GRANT.md")

# Markdown header in the draft -> exact label rendered on the form.
MAP = {
    "Team": "Team",
    "Project overview": "Project overview",
    "Raise details": "Raise details",
    "Integrated chains": "Integrated chains",
    "Tools, infrastructure and frameworks": "Tools, Infrastructure & Frameworks",
    "Starknet specifics": "Starknet specifics",
    "Starknet language": "Starknet language",
    "Starknet contributions": "Starknet contributions",
    "Proposed solution": "Proposed Solution",
    "Project KPIs": "Project KPIs",
    "User acquisition strategy": "User Acquisition Strategy",
    "Business model": "Business model",
    "Project cost components": "Project cost components",
    "Security and audits": "Security and Audits",
}

text = SRC.read_text(encoding="utf-8")


def section(header):
    """The blockquote body following **header**, up to the next bold header."""
    m = re.search(rf"^\*\*{re.escape(header)}\*\*\s*$", text, re.M)
    if not m:
        return None
    rest = text[m.end():]
    stop = re.search(r"^(\*\*[^*]+\*\*|## |---)", rest, re.M)
    body = rest[: stop.start()] if stop else rest

    lines = []
    for raw in body.splitlines():
        if not raw.startswith(">"):
            continue
        lines.append(raw[1:].lstrip() if raw[1:2] == " " else raw[1:])

    out = "\n".join(lines).strip()
    out = out.replace("`", "")
    out = re.sub(r"\*\*(.+?)\*\*", r"\1", out)
    # Rewrap: the draft is hard-wrapped at 100 cols, a form field is not.
    paras = [re.sub(r"\s*\n\s*", " ", p).strip() for p in re.split(r"\n\s*\n", out)]
    return "\n\n".join(p for p in paras if p)


answers, blocked, missing = {}, [], []
for header, label in MAP.items():
    body = section(header)
    if body is None:
        missing.append(header)
        continue
    if "[OPEN:" in body:
        blocked.append(header)
        continue
    answers[label] = body

if missing:
    print("NO SECTION FOUND:", ", ".join(missing), file=sys.stderr)
if blocked:
    print("SKIPPED, still carries an [OPEN: ] note:", ", ".join(blocked), file=sys.stderr)

Path("spikes/fill-long.js").write_text(
    "(function(){var a=" + json.dumps(answers, ensure_ascii=False) + ";"
    "return Object.keys(a).map(function(k){return __fill(k,a[k]);}).join('\\n');})()",
    encoding="utf-8",
)
print(f"wrote spikes/fill-long.js with {len(answers)} answers")
for label, body in answers.items():
    print(f"  {len(body):5d} chars  {label}")
