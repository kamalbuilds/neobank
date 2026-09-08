#!/usr/bin/env bash
#
# Sealed launch thread -> X.
#
# Posts the thread from @kamalbuilds with the square video on post 1, chains the
# four replies, then retweets post 1 from @sealedcash.
#
# THIS SCRIPT PUBLISHES. There is no dry-run and X has no undo beyond delete.
# Read it once, then run it once:
#
#   bash ~/Desktop/neobank/marketing/launch-x/post.sh
#
# Every id it creates is appended to posted-ids.json as it goes, so a failure
# halfway through leaves you the ids you need to finish by hand.
#
# CLI syntax verified against social-cli 0.1.0 / twitter-cli 0.8.5 on 2026-09-08:
#   social account switch NAME          (NOT `account use`)
#   social post TEXT -v FILE -a NAME    (text is positional, NOT --text)
#   social reply TWEET_ID TEXT -a NAME  (both positional)
#   social retweet TWEET_ID -a NAME
# Account NAMES are `kamalbuilds` and `sealed`. `sealedcash` is the username of
# the account named `sealed`, and `social account switch sealedcash` fails.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

THREAD_JSON="$HERE/thread.json"
VIDEO="$HERE/sealed-square-x.mp4"
IDS_FILE="$HERE/posted-ids.json"

AUTHOR_ACCOUNT="kamalbuilds"   # username @kamalbuilds
PRODUCT_ACCOUNT="sealed"       # username @sealedcash

# --- preflight ------------------------------------------------------------

command -v social  >/dev/null || { echo "social CLI not on PATH" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 not on PATH" >&2; exit 1; }
[ -f "$THREAD_JSON" ] || { echo "missing $THREAD_JSON" >&2; exit 1; }
[ -s "$VIDEO" ]       || { echo "missing or empty $VIDEO" >&2; exit 1; }

reply_count="$(python3 -c 'import json,sys;print(len(json.load(open(sys.argv[1]))["replies"]))' "$THREAD_JSON")"
[ "$reply_count" = "4" ] || { echo "expected 4 replies in thread.json, found $reply_count" >&2; exit 1; }

# Both accounts must resolve to a configured NAME before anything is published.
for acct in "$AUTHOR_ACCOUNT" "$PRODUCT_ACCOUNT"; do
  social account list \
    | python3 -c 'import json,sys;n=sys.argv[1];d=json.load(sys.stdin)["data"];sys.exit(0 if any(a["name"]==n for a in d) else 1)' "$acct" \
    || { echo "account name '$acct' is not configured (social account list)" >&2; exit 1; }
done

echo "preflight ok: thread.json has 4 replies, video is $(wc -c < "$VIDEO" | tr -d ' ') bytes"
echo

# --- helpers --------------------------------------------------------------

# thread_text post | thread_text reply N
thread_text() {
  python3 - "$THREAD_JSON" "$@" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
if sys.argv[2] == "post":
    sys.stdout.write(data["post"])
else:
    sys.stdout.write(data["replies"][int(sys.argv[3])])
PY
}

# Reads a social-cli result on stdin, prints the created tweet id, or exits 1.
#
# Two response shapes have to be handled, because post-with-video and
# post-without-video take different code paths inside social-cli:
#
#   video post (GraphQL CreateTweet):
#     {"ok": true, "data": "https://x.com/i/web/status/1234"}
#   reply / retweet (shells out to twitter-cli, OUTPUT=json):
#     {"ok": true, "data": {"ok": true, "schema_version": "1",
#      "data": {"success": true, "action": "reply", "id": "1234",
#               "replyTo": "...", "url": "https://x.com/i/status/1234"}}}
#
# So: fail on either level's ok=false, then find an id or a status/<digits> URL
# anywhere in the payload.
# The extractor source lives in a variable and is passed with `python3 -c` on
# purpose. Feeding it on a heredoc would attach the heredoc to stdin, and the
# piped tweet payload would never reach sys.stdin.read().
EXTRACT_PY='
import json, re, sys

raw = sys.stdin.read()
try:
    payload = json.loads(raw)
except json.JSONDecodeError:
    sys.stderr.write("social returned non-JSON:\n%s\n" % raw[:800])
    sys.exit(1)

def fail(node):
    if isinstance(node, dict):
        if node.get("ok") is False:
            sys.stderr.write("social reported failure: %s\n" % json.dumps(node)[:800])
            sys.exit(1)
        fail(node.get("data"))

fail(payload)

def find(node):
    if isinstance(node, dict):
        for key in ("id", "tweet_id", "rest_id"):
            value = node.get(key)
            if value:
                return str(value)
        for value in node.values():
            got = find(value)
            if got:
                return got
    elif isinstance(node, str):
        m = re.search(r"status/(\d+)", node)
        if m:
            return m.group(1)
    return ""

tweet_id = find(payload)
if not tweet_id:
    sys.stderr.write("posted, but no tweet id in the response:\n%s\n" % raw[:800])
    sys.exit(1)
print(tweet_id)
'

extract_id() {
  python3 -c "$EXTRACT_PY"
}

record() {  # record <label> <id>
  printf '{"label":"%s","id":"%s","url":"https://x.com/i/status/%s","at":"%s"}\n' \
    "$1" "$2" "$2" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$IDS_FILE"
}

# --- 1. post 1, with the video, from @kamalbuilds -------------------------

echo "switching to $AUTHOR_ACCOUNT"
social account switch "$AUTHOR_ACCOUNT"

echo "posting the opener with $VIDEO (the upload is chunked, give it a minute)"
post_out="$(social post "$(thread_text post)" -v "$VIDEO" -a "$AUTHOR_ACCOUNT")"
echo "$post_out"
root_id="$(printf '%s' "$post_out" | extract_id)"
record "post" "$root_id"
echo "post 1 id: $root_id  https://x.com/kamalbuilds/status/$root_id"
echo

# --- 2. the four replies, each chained to the one before -------------------

prev_id="$root_id"
for i in 0 1 2 3; do
  echo "replying to $prev_id (reply $((i + 1))/4)"
  reply_out="$(social reply "$prev_id" "$(thread_text reply "$i")" -a "$AUTHOR_ACCOUNT")"
  echo "$reply_out"
  reply_id="$(printf '%s' "$reply_out" | extract_id)"
  record "reply$((i + 1))" "$reply_id"
  echo "reply $((i + 1)) id: $reply_id"
  echo
  prev_id="$reply_id"
  sleep 3
done

# --- 3. retweet post 1 from @sealedcash ------------------------------------

echo "switching to $PRODUCT_ACCOUNT (@sealedcash)"
social account switch "$PRODUCT_ACCOUNT"

echo "retweeting $root_id from @sealedcash"
# `social retweet` prints {"ok": false, ...} and still exits 0, so the result has
# to be inspected or a failed retweet passes silently. extract_id exits 1 on
# either level's ok=false.
rt_out="$(social retweet "$root_id" -a "$PRODUCT_ACCOUNT")"
echo "$rt_out"
printf '%s' "$rt_out" | extract_id > /dev/null
record "retweet" "$root_id"
echo

echo "done. thread root: https://x.com/kamalbuilds/status/$root_id"
echo "ids recorded in $IDS_FILE"
echo "the active account is now '$PRODUCT_ACCOUNT'; run 'social account switch $AUTHOR_ACCOUNT' before replying to people as yourself."
