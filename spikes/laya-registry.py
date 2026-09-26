#!/usr/bin/env python3
"""Classify every STRK20 hackathon project with Laya on the mini, and diff it
against the keyword pass the competitive research used."""
import json
import re
import sys
import time
import urllib.request

LAYA = "http://100.88.201.86:8127/v1/systemone"
QUESTIONS = {
    # Short list labels. Long dict criteria measurably confused the 421M model:
    # "private payment links" came back as defi.
    "lane": {
        "type": "choice",
        "instructions": "What kind of product is this?",
        "criteria": ["payments", "trading or betting", "bank account", "developer tool", "game", "ai agent"],
    },
    "rival": {
        "type": "choice",
        "instructions": "Is this a private place for a person to keep and spend their own money?",
        "criteria": ["yes", "no"],
    },
}
KEYWORDS = re.compile(r"neobank|bank|wallet|account|card|spend|payroll|pay|salary|savings", re.I)


def ask(state):
    body = json.dumps({"state": state, "questions": QUESTIONS}).encode()
    req = urllib.request.Request(LAYA, body, {"content-type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def main():
    projects = json.load(open("/tmp/projects.json"))
    rows, t0 = [], time.time()
    for p in projects:
        desc = p.get("desc_v6") if isinstance(p.get("desc_v6"), str) else ""
        text = f"{p['name']}. {p.get('one_liner') or ''} {desc[:600]}"
        a = ask(text)["answers"]
        rows.append({
            "name": p["name"],
            "declared": p.get("category"),
            "lane": a["lane"]["choice"],
            "lane_p": a["lane"]["top_probability"],
            "rival": a["rival"]["choice"],
            "rival_p": a["rival"]["top_probability"],
            "keyword": bool(KEYWORDS.search(text)),
            "verified_txs": p.get("verified_txs"),
            "status": p.get("status"),
        })
    json.dump(rows, open("/tmp/laya-registry.json", "w"), indent=1)
    print(f"{len(rows)} projects in {time.time() - t0:.1f}s", file=sys.stderr)


if __name__ == "__main__":
    # Self-check before the batch: two projects that must land in different lanes.
    known = {
        "Private payment links you can send to anyone.": "payments",
        "A shielded prediction market for betting on outcomes.": "trading or betting",
        "A private neobank account with a debit card.": "bank account",
        "An SDK for developers to integrate privacy.": "developer tool",
    }
    for text, want in known.items():
        got = ask(text)["answers"]["lane"]["choice"]
        assert got == want, f"self-check failed: {text!r} -> {got}, expected {want}"
    print("self-check ok: 4 of 4 known lanes", file=sys.stderr)
    main()
