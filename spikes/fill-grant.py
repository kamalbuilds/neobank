#!/usr/bin/env python3
"""Fill the Starknet Seed Grant Airtable form in the deepsurge tab, then read
every field back and report anything that did not land.

Answers come from docs/submission/STARKNET_SEED_GRANT.md so the form and the
repo cannot drift. Fields are addressed by aria-label (long fields) or by the
visible question label (short fields); element refs shift on every Airtable
re-render and once put the email into "Contact full name".
"""
import base64
import json
import re
import subprocess
import sys
from pathlib import Path

DRAFT = Path("docs/submission/STARKNET_SEED_GRANT.md").read_text(encoding="utf-8")

SHORT = {
    "Project name": "Sealed",
    "Website URL": "https://sealed.cash",
    "Project GitHub": "https://github.com/kamalbuilds/neobank",
    "Contact full name": "Kamal Nayan",
    "Contact email": "kamalthedev7@gmail.com",
    "Contact Telegram handle": "@kamalthedev",
    "Contact GitHub username": "kamalbuilds",
    "TG group <> SNF": "N/A",
    "Project X URL": "https://x.com/sealedcash",
    "Funding amount": "25000",
    "Milestone 1 name": "Everything on mainnet",
    "Milestone 1 amount": "11000",
    "Milestone 1 completion date": "December 19, 2026",
    "Number of users": "1",
    "Number of transactions": "4",
    "Revenue": "0",
    "Signatory full name": "Kamal Nayan",
    "Signatory email": "kamalthedev7@gmail.com",
    "Signatory title": "Founder",
    "Referral": "STRK20 Private Sprint, run by StarkWare's STRK20 team",
}

# Draft header -> form aria-label.
LONG = {
    "One liner": "One liner",
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
    "Track record": "Track Record",
    "Other Starknet grant programs": "Other Starknet Grant Programs",
    "Other grants": "Other Grants",
    "Starknet collaborations": "Starknet collaborations",
    "Extra support": "Extra support",
}
EXTRA_LONG = {
    "Team GitHub Handles": "kamalbuilds, aarav1656",
    "Other social URL": "https://x.com/kamalbuilds",
    "Other metrics": (
        "Everything we report is read from chain, not from analytics. On Starknet mainnet: 4 "
        "transactions through the canonical STRK20 pool, all re-verified against a live RPC by "
        "npm run verify:claim. On Sepolia: 8 Cairo contracts deployed and verified 8 of 8, 5 card "
        "settlements read from our settlement contract events, and 11 of 11 evidence values "
        "passing our verifier. The pool Sealed builds on counted 415 distinct depositors in the "
        "30 days to 2026-09-23, from a full event scan at block 15,316,804."
    ),
}
# (label, nth occurrence in form order): phase, project live, network, applied to Seed Grant before.
RADIOS = [("MVP/Development", 0), ("Yes", 0), ("Yes - Mainnet", 0), ("No", 1)]

HELPERS = r"""
window.__short=function(label,v){var labs=[...document.querySelectorAll('div,label,span,h3,p')].filter(function(n){return n.children.length===0&&n.textContent.trim()===label});
for(var i=0;i<labs.length;i++){var n=labs[i];for(var u=0;u<7&&n;u++){n=n.parentElement;if(!n)break;var c=n.querySelector('textarea,input[type=text],input:not([type])');
if(c){var p=c instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(c,v);
c.dispatchEvent(new Event('input',{bubbles:true}));c.dispatchEvent(new Event('change',{bubbles:true}));c.dispatchEvent(new Event('blur',{bubbles:true}));return 'OK'}}}return 'NOFIELD'};
window.__ed=function(label){var e=document.querySelector('[role=textbox][aria-label="'+label+'"]');if(e)return e;var L=label.toLowerCase();
var labs=[...document.querySelectorAll('div,label,span,h3,p')].filter(function(n){return n.children.length===0&&n.textContent.trim().toLowerCase()===L});
for(var i=0;i<labs.length;i++){var n=labs[i];for(var u=0;u<7&&n;u++){n=n.parentElement;if(!n)break;var c=n.querySelector('[contenteditable=true],[contenteditable=plaintext-only]');if(c)return c}}return null};
window.__readLong=function(label){var e=__ed(label);return e?e.textContent.trim().length:-1};
window.__long=function(label,v){var e=__ed(label);if(!e)return 'NOFIELD';e.focus();
var s=getSelection(),r=document.createRange();r.selectNodeContents(e);s.removeAllRanges();s.addRange(r);document.execCommand('insertText',false,v);
e.dispatchEvent(new Event('input',{bubbles:true}));return 'OK'};
window.__readShort=function(label){var labs=[...document.querySelectorAll('div,label,span,h3,p')].filter(function(n){return n.children.length===0&&n.textContent.trim()===label});
for(var i=0;i<labs.length;i++){var n=labs[i];for(var u=0;u<7&&n;u++){n=n.parentElement;if(!n)break;var c=n.querySelector('textarea,input[type=text],input:not([type])');if(c)return c.value}}return null};
'helpers'
"""


def section(header):
    """Blockquote body after **header**, [OPEN: ...] notes stripped, rewrapped."""
    m = re.search(rf"^\*\*{re.escape(header)}\*\*\s*$", DRAFT, re.M)
    if not m:
        return None
    rest = DRAFT[m.end():]
    stop = re.search(r"^(\*\*[^*]+\*\*|## |---|### )", rest, re.M)
    body = rest[: stop.start()] if stop else rest
    lines = [l[2:] if l.startswith("> ") else l[1:] for l in body.splitlines() if l.startswith(">")]
    text = "\n".join(lines).strip().replace("`", "")
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    paras = [re.sub(r"\s*\n\s*", " ", p).strip() for p in re.split(r"\n\s*\n", text)]
    paras = [re.sub(r"\[OPEN:.*?\]", "", p).strip() for p in paras if not p.startswith("[OPEN:")]
    paras = [p for p in paras if p and not p.startswith("(Kamal") and not p.startswith("(pick")]
    return "\n\n".join(paras)


def milestone(n):
    start = DRAFT.index(f"### Milestone {n}")
    seg = DRAFT[start: DRAFT.index("**Amount**", start)]
    body = seg[seg.index("**Deliverables**") + len("**Deliverables**"):]
    lines = [l[2:] if l.startswith("> ") else l[1:] for l in body.splitlines() if l.startswith(">")]
    text = "\n".join(lines).strip().replace("`", "")
    return "\n\n".join(re.sub(r"\s*\n\s*", " ", p).strip() for p in re.split(r"\n\s*\n", text) if p.strip())


TARGET = None  # deepsurge tab id holding the form; other sessions switch the shared tab


def js(expr):
    # Re-pin before every call and refuse to act anywhere but Airtable.
    if TARGET:
        subprocess.run(["bhn", "deepsurge", "use", TARGET], capture_output=True)
        host = subprocess.run(["bhn", "deepsurge", "eval", "location.hostname"], capture_output=True, text=True).stdout
        if "airtable.com" not in host:
            return "WRONG_TAB"
    out = subprocess.run(["bhn", "deepsurge", "eval", expr], capture_output=True, text=True).stdout
    last = [l for l in out.splitlines() if l.strip()][-1] if out.strip() else "{}"
    try:
        return json.loads(last).get("value")
    except json.JSONDecodeError:
        return last


def b64call(fn, label, value):
    b = base64.b64encode(value.encode("utf-8")).decode()
    return js(f"{fn}({json.dumps(label)},new TextDecoder().decode(Uint8Array.from(atob('{b}'),function(c){{return c.charCodeAt(0)}})))")


def main():
    global TARGET
    tabs = json.loads(subprocess.run(["bhn", "deepsurge", "tabs"], capture_output=True, text=True).stdout)
    TARGET = next(t["targetId"] for t in tabs["tabs"] if "airtable.com/appfoRv2ottjRfTpL" in t["url"])
    js(HELPERS)
    results = {}

    long_answers = dict(EXTRA_LONG)
    for header, label in LONG.items():
        body = section(header)
        if body:
            long_answers[label] = body
        else:
            results[label] = "NO DRAFT SECTION"
    long_answers["M1 Description"] = milestone(1)

    for label, value in SHORT.items():
        results[label] = js(f"__short({json.dumps(label)},{json.dumps(value)})")
    for label, value in long_answers.items():
        results[label] = b64call("__long", label, value)

    radios = js("[...document.querySelectorAll('[role=radio]')].map(function(e){return e.textContent.trim()})")
    for want, nth in RADIOS:
        idx = [j for j, t in enumerate(radios or []) if t == want]
        js(f"document.querySelectorAll('[role=radio]')[{idx[nth]}].click();1")

    # Read back. Short fields by value, long fields by length, radios by checked state.
    print("== short fields")
    for label, value in SHORT.items():
        got = js(f"__readShort({json.dumps(label)})") or ""
        norm = lambda s: re.sub(r"[^0-9a-z@./:]", "", str(s).lower())
        ok = norm(value) in norm(got) or norm(got) in norm(value) and got
        print(f"  {'OK ' if ok else 'BAD'} {label:30} {str(got)[:48]}")
    print("== long fields")
    for label, value in long_answers.items():
        got = js(f"__readLong({json.dumps(label)})")
        got = got if isinstance(got, int) else -1
        ok = got >= min(len(value), 20) * 0.9
        print(f"  {'OK ' if ok else 'BAD'} {label:36} {got:5d} chars (draft {len(value)})")
    print("== radios checked:", js("[...document.querySelectorAll('[role=radio][aria-checked=true]')].map(function(e){return e.textContent.trim()}).join(' | ')"))


if __name__ == "__main__":
    main()
