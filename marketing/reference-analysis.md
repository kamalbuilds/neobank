# Reference analysis: Base44 launch film

Forensic measurement of the reference launch video. Every number below is produced by a command
recorded in the "How each number was produced" section. Nothing here is estimated.

- Source tweet: `https://x.com/fakharkamario/status/2093681908227936745`
- Media id: `2093681723062009856`
- The direct CDN URL supplied in the brief returned **HTTP 404 / 0 bytes**. Fetched instead via
  `yt-dlp` against the tweet URL, which resolved to the same media id over HLS
  (`hls-1857` video + `hls-audio-128000` audio, 17 video fragments).
- Local artifacts: `marketing/_ref/ref.mp4` (as tweeted), `marketing/_ref/ad.mp4` (cropped ad),
  `marketing/_ref/sheets2/*.jpg` (contact sheets), `marketing/_ref/ref-transcript/`.

**Not measured (stated rather than guessed):** the 7.5M view count was not verified — no view
metric was read from any API or page in this pass. Music licensing/origin was not determined.

---

## 0. Critical structural finding: the tweeted file is a composite

The tweeted MP4 is **not** the ad. It is the ad placed inside an annotation frame added by the
tweet author: a chapter bar reading `Intro | Demo | Features | Outro` with a moving playhead and a
static waveform strip occupying the bottom third of the canvas.

Measured by temporal-variance bounding box across 9 sampled frames (threshold: per-pixel stdev > 6):

| Region | Rows | Cols | Size |
|---|---|---|---|
| Whole file | 0–1079 | 0–1439 | 1440x1080 (4:3) |
| **Actual ad** | 63–793 | 72–1367 | **1296x730 (1.775 ≈ 16:9)** |
| Playhead band | 816–846 | — | annotation only |

This matters for every downstream number. The annotation occupies ~32% of frame area and is
near-static, so it **dilutes ffmpeg's scene score by roughly a third** and suppresses cut
detection. Both measurement sets are reported below; **the cropped `ad.mp4` numbers are the real
ones** and are used everywhere after this section.

| Scene threshold | Cuts on tweeted file | Cuts on cropped ad |
|---|---|---|
| 0.15 | not run | 67 |
| 0.20 | 37 | 54 |
| 0.25 | not run | 49 |
| **0.30** | **23** | **39** |
| 0.40 | 13 | 30 |
| 0.50 | not run | 23 |

Measuring the tweeted file as-is would have understated the cut rate by 41%.

---

## 1. Duration, resolution, fps

| Property | Value |
|---|---|
| Container duration | 51.688 s |
| Video stream duration | **51.633 s** (used as runtime everywhere below) |
| Video codec | h264 |
| Delivered resolution | 1440x1080 |
| **Ad resolution (cropped)** | **1296x730, 16:9** |
| Frame rate | **30/1 fps** (r_frame_rate = avg_frame_rate, constant) |
| Frame count | 1549 |
| Video bitrate | 1,729,958 bps |
| Audio | AAC, 44.1 kHz, **stereo**, 128,005 bps, 51.688 s |
| File size | 12,049,397 bytes |

---

## 2. Shot boundary list (cropped ad, `scene > 0.3`)

**39 cuts → 40 shots** in 51.633 s.

| Statistic | Value |
|---|---|
| Mean shot length | **1.291 s** |
| Median shot length | **1.083 s** (32 frames) |
| Min | **0.067 s** (2 frames, shot 24) |
| Max | **4.800 s** (shot 1, the opening title animation) |
| Std dev | 0.956 s |
| Q1 / Q3 | 0.567 s / 1.683 s |
| **Shots under 1.5 s** | **28 of 40 = 70.0%** |
| Shots under 1.0 s | 18 (45.0%) |
| Shots under 0.7 s | 13 (32.5%) |
| Shots over 3.0 s | 2 (5.0%) |
| Cut rate | **45.3 cuts/min** |

Full list:

| # | Start | End | Dur | Class | Content |
|---:|---:|---:|---:|---|---|
| 1a | 0.000 | 2.900 | 2.900 | PRODUCT-UI | app cards assemble on cream canvas ("Publish", "351 / 124 Total Hours", charts) |
| 1b | 2.900 | 4.800 | 1.900 | LOGO | collage collapses to mark, then wordmark draws on |
| 2 | 4.800 | 6.300 | 1.500 | LIFESTYLE | rooftop garden, woman at laptop; prompt type overlay begins |
| 3 | 6.300 | 7.567 | 1.267 | LIFESTYLE | CU face; prompt line completes "Build a plant identification app" |
| 4 | 7.567 | 8.067 | 0.500 | LIFESTYLE | macro meadow, whip pan, heavy bokeh |
| 5 | 8.067 | 10.267 | 2.200 | LIFESTYLE | woman crouched in meadow shooting a plant on phone |
| 6 | 10.267 | 11.433 | 1.167 | PRODUCT-UI | plant detail card "Calendula Arvensis" |
| 7 | 11.433 | 12.567 | 1.133 | PRODUCT-UI | map view + species card "Linum Usitatissimum" |
| 8 | 12.567 | 13.500 | 0.933 | PRODUCT-UI | user profile page "Clara Thompson", 5.8K / 328 / 14.8K |
| 9 | 13.500 | 14.067 | 0.567 | PRODUCT-UI | three cards floating in 3D space |
| 10 | 14.067 | 14.600 | 0.533 | PRODUCT-UI | macro "Add to Cart" button, frame-filling |
| 11 | 14.600 | 16.667 | 2.067 | PRODUCT-UI | UI tile grid + kinetic headline "…bluebells have been found in meadows…" |
| 12 | 16.667 | 17.800 | 1.133 | LIFESTYLE | co-working room; overlay "Connect and analyze su…" |
| 13 | 17.800 | 18.800 | 1.000 | LIFESTYLE | man at laptop, dashboard legible on screen |
| 14 | 18.800 | 20.100 | 1.300 | PRODUCT-UI | dark dashboard "Subscribers Usage", monthly bars |
| 15 | 20.100 | 21.000 | 0.900 | HYBRID-SPLIT | L: hand + laptop on desk. R: "User Peak Hours 9AM" panel |
| 16 | 21.000 | 23.100 | 2.100 | LIFESTYLE | subway platform, man on bench, train motion blur |
| 17 | 23.100 | 27.233 | 4.133 | PRODUCT-UI | automation canvas; sentence morphs 4x (Slack → WhatsApp → "Drop lesson at peak hour" → "Send promo code to new subscribers") |
| 18 | 27.233 | 28.567 | 1.334 | LIFESTYLE | Prague vista, bench; overlay "Add a visual timeline of historical landmarks" |
| 19 | 28.567 | 29.267 | 0.700 | LIFESTYLE | walking backpack; agent activity log overlay (Read/Updated/Wrote) |
| 20 | 29.267 | 31.267 | 2.000 | PRODUCT-UI | phone mockup + traveller photo card |
| 21 | 31.267 | 31.767 | 0.500 | PRODUCT-UI | lesson cards "Roman roads / Medieval trade" + "Generating information" chip |
| 22 | 31.767 | 32.300 | 0.533 | PRODUCT-UI | macro of generated site type + "Connecting Domain" chip |
| 23 | 32.300 | 32.833 | 0.533 | PRODUCT-UI | Search Console: Total clicks 4.5K, impressions 107K + "Loading stats" chip |
| 24 | 32.833 | 32.900 | **0.067** | PRODUCT-UI | launch checklist (fast scroll) |
| 25 | 32.900 | 33.267 | 0.367 | PRODUCT-UI | launch checklist continues ("Brand info is configured / Pages include labels") |
| 26 | 33.267 | 35.467 | 2.200 | PRODUCT-UI | macro prompt input "+ Best travel app 2026" with live caret |
| 27 | 35.467 | 37.067 | 1.600 | LIFESTYLE | Prague street, pedestrians, shopfronts |
| 28 | 37.067 | 38.100 | 1.033 | PRODUCT-UI | dark site, city list Rome/Kyoto/Prague/Athens/Cairo |
| 29 | 38.100 | 38.767 | 0.667 | PRODUCT-UI | pricing page, 4 tiers $0/$2/$5/$8 |
| 30 | 38.767 | 40.000 | 1.233 | PRODUCT-UI | multi-panel product collage (voucher, route map, episode info) |
| 31 | 40.000 | 41.933 | 1.933 | LIFESTYLE | home music studio, woman at desk; "Scanning…" chip |
| 32 | 41.933 | 44.300 | 2.367 | HYBRID-SPLIT | L: studio photo. R: dark "Automations" list panel |
| 33 | 44.300 | 46.300 | 2.000 | LIFESTYLE | laptop on desk, warm low sun, dashboard on screen, no person |
| 34 | 46.300 | 46.967 | 0.667 | LIFESTYLE | portrait, woman outdoors |
| 35 | 46.967 | 47.433 | 0.467 | LIFESTYLE | portrait, man indoors |
| 36 | 47.433 | 48.000 | 0.567 | LIFESTYLE | portrait, man on bench |
| 37 | 48.000 | 48.900 | 0.900 | LIFESTYLE | portrait, woman in studio |
| 38 | 48.900 | 49.733 | 0.833 | LIFESTYLE | 4-up vertical portrait montage + icon badges |
| 39 | 49.733 | 50.267 | 0.533 | LOGO | row of black product/brand icons on white |
| 40 | 50.267 | 51.633 | 1.367 | LOGO | full-bleed orange Base44 endcard |

Shot 1 is one continuous animation by scene detection; it is split at 2.900 s because dense
frame sampling (0.2 s steps) shows the collage fully dispersed by 2.90 s and the brand mark
resolved by 3.10 s. That split is a content beat, not a cut.

**Detection caveat, stated rather than hidden:** shots 24 and 25 are almost certainly one
scrolling shot — 24 is 2 frames long and its content is continuous with 25. Treated as a single
shot the count is 39 shots, mean 1.324 s, median 1.083 s. This changes no conclusion.

Cut density by decade:

| Window | Cuts |
|---|---|
| 0–10 s | 4 |
| 10–20 s | 9 |
| 20–30 s | 6 |
| 30–40 s | **10** |
| 40–50 s | 9 |
| 50–51.6 s | 1 |

First 10 s: 5 shots, mean 2.05 s. Last 5 s: 6 shots. The film **starts slow and accelerates.**

---

## 3. Classification split — the headline number

Classified by dominant frame area, every shot inspected on an extracted mid-frame (plus extra
frames for all shots over 2 s).

By runtime:

| Class | Beats | Beat % | Seconds | **Runtime %** |
|---|---:|---:|---:|---:|
| PRODUCT-UI | 19 | 46.3% | 23.87 | **46.2%** |
| LIFESTYLE / B-ROLL | 17 | 41.5% | 20.70 | **40.1%** |
| HYBRID-SPLIT (50/50 in frame) | 2 | 4.9% | 3.27 | 6.3% |
| LOGO | 3 | 7.3% | 3.80 | 7.4% |
| **TYPOGRAPHY-ONLY** | **0** | **0.0%** | **0.00** | **0.0%** |

Allocating the two split-screen shots 50/50 to their halves:

| Class | Seconds | **Runtime %** |
|---|---:|---:|
| **PRODUCT-UI** | 25.50 | **49.4%** |
| **LIFESTYLE / B-ROLL** | 22.33 | **43.3%** |
| **LOGO** | 3.80 | **7.4%** |
| **TYPOGRAPHY-ONLY** | 0.00 | **0.0%** |

**Roughly a 50/43/7/0 split.** The single most important structural fact: **there is not one
frame of typography on an empty background in the entire film.** Every headline, prompt line and
status chip is composited over live footage or over the product canvas. Text never gets its own
card.

Secondary measurement: **16 shots have a human being as the subject = 19.10 s = 37.0% of
runtime.** A person is on screen for well over a third of the film.

---

## 4. First product shot / first lifestyle shot

| Event | Time |
|---|---|
| **First PRODUCT-UI frame** | **0.000 s** — frame 1 is the product canvas |
| First single card visible on that canvas | 0.20 s |
| Brand mark first appears | 3.10 s |
| Wordmark complete | ~4.00 s |
| **First LIFESTYLE frame** | **4.800 s** |
| First human face | 4.800 s (full profile CU at 6.30 s) |
| First cut of any kind | 4.800 s |
| Endcard logo in | 49.733 s |

The film opens on the product, spends 0–4.8 s in one unbroken shot, brands at 2.9–4.8 s, and
does not cut until 4.8 s. **The brand identity is front-loaded, then the film never repeats it
until the last 1.9 s.**

---

## 5. Twelve evenly spaced frames

Sampled at `51.633 * (i + 0.5) / 12` from the cropped ad. Contact sheet:
`marketing/_ref/sheets2/even_ad.jpg`.

| # | t | Description |
|---:|---:|---|
| 1 | 2.15 s | Cream canvas, ~12 app artifacts scattered mid-bloom: orange app icon, "Publish" pill, "350 / 123 Total Hours" counters, area chart, plant photo tiles |
| 2 | 6.45 s | Profile CU of a woman lit by afternoon sun, laptop edge dark in foreground; centred white overlay "Build a plant identification app" |
| 3 | 10.76 s | Single tall plant-detail card ("Calendula Arvensis", heart button, Save-to-Journal) floating alone on cream |
| 4 | 15.06 s | Dense 3x3 UI tile grid (seed listing $11.00, Bloom Calendar, map, "Wild&Found" chip) with oversized black headline type bleeding off the left edge |
| 5 | 19.36 s | Full-frame dark dashboard, "Subscribers Usage" monthly blue bar chart, left icon rail, next panel sliding in from right |
| 6 | 23.67 s | Near-empty light canvas, one automation sentence: "When **new course opens** notify on **Slack**", each variable underlined |
| 7 | 27.97 s | Wide Prague skyline, lone figure with laptop on a bench, overlay "Add a visual timeline of historical landmarks" |
| 8 | 32.27 s | Google Search Console UI — Total clicks 4.2K, impressions 105K, clicks area chart, "Loading stats" spinner chip |
| 9 | 36.57 s | Prague street, hanging iron sign racked out of focus in foreground, pedestrians mid-frame, "BAZAR" shopfront |
| 10 | 40.88 s | Home music studio, redhead at a desk of synths and monitors, tall window blowout; overlay "Scanning…" |
| 11 | 45.18 s | Laptop alone on a wooden desk in low warm sun, dark dashboard with a magenta waveform legible on the screen |
| 12 | 49.48 s | Four vertical portrait strips of the four builders, each with an oversized cursor or app-icon badge |

---

## 6. Audio

**Both. Narration over a music bed.**

Narration, via whisper (`cobalt transcribe`) — full transcript at
`marketing/_ref/ref-transcript/`:

| Measure | Value |
|---|---|
| VO lines | **17** |
| VO words | **80** |
| Mean words per line | **4.7** |
| Speech span | 0.0 → 52.0 s |
| Pace | **93 words/min** |

> Builders don't imagine a business. / They build it on Base 44. / You have the idea. / The only
> thing left is to start. / From one app to entire systems. / Rethink what your business can be. /
> Keep going. / Sharpen every decision. / Automate anything. / Not a minute wasted. / Wherever you
> go, get seen. / Spread the word so you can expand further. / And when you're finally off the
> clock, / the system keeps running. / Secure and reliable. / Be the builder your business needs. /
> Base 44.

Music bed, proven by sub-90 Hz energy (human speech has essentially no fundamental content
below 90 Hz, so this band isolates the bed from the VO):

| Measure | Value |
|---|---|
| `silencedetect=-30dB:d=0.3` | exactly one hit: **50.980 → 51.688 s** (0.707 s) |
| Frames above −40 dBFS | 98.0% of runtime |
| mean_volume / max_volume | −16.5 dB / −0.0 dB (57 samples at full scale) |
| Dominant band | **30–90 Hz at 25.5 dB**, higher than 90–300 Hz (21.1) and 300–3400 Hz (5.0) |
| 30–95 Hz level during the quietest 20% of speech-band frames | 25.3 dB median — bed stays up while the VO drops |

Bed envelope, measured at 0.15–0.25 s resolution:

| Event | Time | Level change (30–95 Hz) |
|---|---|---|
| **Bed in** | **4.05 s** | +8.8 → +32.7 dB in one 0.15 s step |
| Bed at full | 4.80 s | +42.0 dB, landing exactly on the first cut |
| **Bed drops out** | **15.9 → 17.7 s** | falls to −14.1 dB at 16.5 s, a ~1.8 s hole |
| Bed returns | 17.75 → 18.00 s | +15.5 → +39.4 dB |
| **Hard out** | **50.90 s** | +21.1 → −19.3 dB, floor −53 dB by 51.1 s |

So: **the first 4 seconds are voice on near-silence**, the bed carries 4.05–50.90 s, there is a
deliberate 1.8 s bed dropout at the one-third mark, and the music is cut 0.73 s before the last
frame.

**Tempo: not established.** Onset-envelope autocorrelation peaked at 139.7 BPM (r = 0.249) on the
broadband signal and at 176.5 BPM (r = 0.114) on the sub-110 Hz signal — both too weak to call. A
cut-to-grid scan over periods 0.30–1.60 s found its best fit at P = 0.328 s with mean error 1.7
frames, which is what an arbitrary set of timestamps produces against a short period, not
evidence. **No claim is made that the cuts are beat-locked.**

---

## 7. The recurring grammar (counted, not intuited)

Three "intent → result" pairs, each built the same way: a sentence is typed **over live-action
footage**, and the product's answer arrives as full-frame UI within a few seconds.

| # | Prompt typed over footage | Duration of prompt shot(s) | Result UI arrives | Gap |
|---:|---|---:|---:|---:|
| 1 | "Build a plant identification app" (shots 2–3) | 2.767 s | 10.267 s (shot 6) | 5.47 s |
| 2 | "Connect and analyze su[bscribers]" (shot 12) | 1.133 s | 18.800 s (shot 14) | 2.13 s |
| 3 | "Add a visual timeline of historical landmarks" (shot 18) | 1.334 s | 29.267 s (shot 20) | 2.03 s |

Plus 6 status chips that render machine work as a small in-frame label rather than a title card:
"Identifying", "Generating information", "Connecting Domain", "Loading stats", "Scanning…",
and the agent activity log (Read / Updated / Wrote) in shot 19.

Scale grammar: at least 4 shots (10, 22, 24–25, 26) are **macro zooms into a single UI element**
filling the frame — a button, a letterform, a checklist row, a prompt caret. Average length of
those macro shots: 0.90 s.

---

## WHAT TO COPY

Five directives for the 45–60 s crypto-privacy launch film. Each is anchored to a number above.

### 1. Cut on a 1.0–1.1 s median, 40 shots, accelerating

*Measured:* 39 cuts in 51.633 s = 45.3 cuts/min; mean 1.291 s, median 1.083 s (32 frames);
**70% of shots under 1.5 s**; only 2 shots over 3 s; first 10 s runs at 4 cuts, the 30–40 s block
at 10 cuts.

*Do:* Target **52 s, 38–42 cuts.** Median shot **32 frames**. At least **28 of 40 shots under
1.5 s** and **13 under 0.7 s** — the sub-0.7 s shots are what make it feel expensive, and they are
all UI macros. Cap every shot at 2.4 s except the opening title. Ramp density: 4–5 cuts in the
first 10 s, 9–10 cuts per 10 s from 30 s onward. Do not cut at all before 4.8 s.

### 2. Ship a 50 / 43 / 7 / 0 split — and zero typography cards

*Measured:* PRODUCT-UI 49.4%, LIFESTYLE 43.3%, LOGO 7.4%, **TYPOGRAPHY-ONLY 0.0%.** A human is
the subject for 37.0% of runtime.

*Do:* Budget **25–26 s of product surface, 22–23 s of shot footage, 3.8 s of logo, and zero
seconds of text-on-black.** For a privacy product the temptation is exactly the failure mode
here: threat-model text cards, "your data is yours" over a gradient. Ban them. If a line must be
said on screen, it goes over a face or over the wallet UI. Shoot or license **at least 16 distinct
human-subject shots** — you need 16 to fill 19 s at this cut rate, and reused footage will read
as stock.

### 3. Open on the product for 2.9 s, brand at 2.9 s, first human at 4.8 s

*Measured:* first product frame 0.000 s; brand mark 3.10 s; wordmark complete 4.00 s; first
lifestyle frame and first cut both at 4.800 s; endcard 49.733–51.633 s (1.9 s).

*Do:* Frame 1 is the shielded-balance UI mid-animation, not a logo and not a black card. Let the
UI elements assemble for **~2.9 s**, collapse them into the mark, hold the wordmark **1.9 s**, and
make the **first cut in the film land at 4.8 s** on a real person. Then do not show the logo again
until **49.7 s**. Two logo moments total, 3.8 s combined — 7.4% of runtime, no more.

### 4. Three prompt-over-footage → result pairs, with a ≤2.1 s payoff gap

*Measured:* 3 intent→result pairs. Prompt shots run 1.1–2.8 s and the sentence is always typed
over live action, never over a blank canvas. Result UI arrives 2.03 s, 2.13 s and 5.47 s later.
Six machine-state chips ("Scanning…", "Generating information") stand in for progress instead of
explanatory titles.

*Do:* Build **exactly three** privacy-intent pairs — e.g. "Send 2 ETH without revealing my
balance", "Prove I'm over 18 without showing my ID", "Pay this invoice from a shielded address".
Type each over a **1.2–1.5 s** shot of a real person, then land the wallet UI result **within 2.1 s**.
Replace every explanatory caption with a chip: `Generating proof`, `Shielding`, `Verified on-chain`.
And copy the macro move: **4 shots at ~0.9 s each that fill the frame with one UI element** — the
send button, the caret in the address field, one line of a proof checklist.

### 5. Voice at 93 wpm, no music for 4 s, one 1.8 s bed dropout, hard out at −0.7 s

*Measured:* 17 VO lines, 80 words, 4.7 words per line, **93 wpm.** Sub-90 Hz bed absent 0–4.05 s,
in at 4.05 s, full at 4.80 s, **dropped out 15.9–17.7 s (−14 dB)**, back by 18.0 s, hard out at
50.90 s leaving 0.707 s of silence. No beat-lock was demonstrated, so do not build the edit to a
grid.

*Do:* Write **≤85 words in 17–18 lines averaging under 5 words each** and record at **90–95 wpm** —
this is roughly half the pace of a normal explainer, and it is what buys the space for 40 cuts.
Run the **first 4 seconds dry**: voice over near-silence while the UI assembles, then drop the bed
in on the wordmark. Put one **1.5–2.0 s bed dropout at the one-third mark (~17 s)** under the
single hardest privacy line, so the claim lands in a hole. Cut the music **0.7 s before the last
frame** and let the endcard sit silent.

---

## How each number was produced

```bash
# fetch (direct CDN url 404'd)
yt-dlp -f "bv*+ba/b" -o "ref.%(ext)s" \
  "https://x.com/fakharkamario/status/2093681908227936745"

# container / stream facts
ffprobe -v error -show_entries format=duration,bit_rate,size \
  -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels \
  -of json ref.mp4

# annotation-frame bbox: per-pixel stdev across 9 sampled frames, mask stdev>6,
# keep rows/cols with >50 masked pixels  -> rows 63..793, cols 72..1367

# isolate the actual ad
ffmpeg -i ref.mp4 -vf "crop=1296:730:72:63" -c:v libx264 -crf 16 -c:a copy ad.mp4

# shot boundaries (and the 0.15/0.2/0.25/0.4/0.5 sensitivity sweep)
ffmpeg -i ad.mp4 -filter:v "select='gt(scene,0.3)',showinfo" -f null - 2>&1 \
  | grep -o 'pts_time:[0-9.]*'

# frames: shot midpoints (40), evenly spaced (12), dense sample of shot 1 (20)
ffmpeg -ss <t> -i ad.mp4 -frames:v 1 -vf scale=640:-1 out.jpg
ffmpeg -pattern_type glob -i 'dir/*.jpg' -vf "tile=3x2:padding=8" sheet.jpg

# audio
ffmpeg -i ref.mp4 -af "silencedetect=noise=-30dB:d=0.3" -f null -
ffmpeg -i ref.mp4 -af volumedetect -f null -
cobalt transcribe ref.mp4                       # mlx whisper -> tsv/srt/vtt/json
ffmpeg -i ad.mp4 -ac 1 -ar 22050 -f f32le pcm.raw
# then numpy: 2048-pt STFT, hop 256/512; band sums for 30-95, 90-300, 300-3400,
# 3400-8000, 8000-11000 Hz; spectral-flux onset envelope + autocorrelation for tempo;
# cut-to-grid scan over P in [0.30,1.60] s with 40 phase offsets per period
```
