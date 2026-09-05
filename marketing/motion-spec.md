# Motion spec, measured from two launch videos

Sources
- ZARO: `/Users/kamal/Downloads/zaro.mp4`, 3840x2160, 30fps container, 68.53s, stereo 48kHz. Contact sheets: `/Users/kamal/Desktop/neobank/marketing/_ref/motion-spec-data/zaro_1fps.jpg` (6 columns, one frame per second, time = row*6+col).
- DASHX: `/Users/kamal/Desktop/neobank/marketing/_ref/dashx.mp4`, 1920x1440, 60fps, 30.00s, stereo 44.1kHz. Downloaded from the twimg CDN URL (HTTP 200, 8,879,894 bytes). Sheet: `motion-spec-data/dashx_2fps.jpg` (6 columns, two frames per second, time = (row*6+col)/2).
- Tooling: ffmpeg `select/scene` and `showinfo`, 40x40 corner crops averaged with `scale=1:1:flags=area`, numpy/PIL on full-res PNG frames, `astats` on a 120Hz low-passed mono mix, mlx_whisper (base) for narration. Per-frame scene-score dumps are in `motion-spec-data/*_scores.txt`.

Every number below states how it was produced. Where a measurement failed it says so.

---

## 1. Shot list

### ZARO, `select='gt(scene,0.25)'` (as specified)

13 boundaries, 14 shots. Frames scoring 1.000 are true hard cuts; 28.33 (0.837), 32.87 (0.686), 56.93 (0.298), 65.13 (0.575) are hard-ish (split-screen swap, flash frame).

| # | start | dur | scene score at boundary |
|---|------:|----:|---|
| 1 | 0.00 | 5.00 | (open) |
| 2 | 5.00 | 3.53 | 1.000 |
| 3 | 8.53 | 2.47 | 1.000 |
| 4 | 11.00 | 8.93 | 1.000 |
| 5 | 19.93 | 2.53 | 1.000 |
| 6 | 22.47 | 5.87 | 1.000 |
| 7 | 28.33 | 4.53 | 0.837 |
| 8 | 32.87 | 11.07 | 0.686 |
| 9 | 43.93 | 2.47 | 1.000 |
| 10 | 46.40 | 10.53 | 1.000 |
| 11 | 56.93 | 1.67 | 0.298 |
| 12 | 58.60 | 6.47 | 1.000 |
| 13 | 65.07 | 0.07 | 1.000 (2-frame flash) |
| 14 | 65.13 | 3.40 | 0.575 |

Stats at 0.25: **mean 4.90s, median 4.03s, under 1.5s: 1/14 = 7%** (and that one is the 2-frame flash), under 2.5s: 29%.

Threshold sensitivity (count of frames above threshold, 2056 frames): 0.03: 209, 0.05: 103, 0.08: 48, 0.10: 32, 0.15: 23, 0.20: 16, 0.25: 13. The video's real rhythm is finer than its hard cuts: most beats are soft (element swaps on a held background). Beat list built from the 1fps sheet anchored to the hard cuts (0.5s resolution):

| start | dur | content | bg |
|------:|----:|---|---|
| 0.00 | 2.50 | "Apps [chip] and [chip] agents" | #1F1413 |
| 2.50 | 2.50 | "with one prompt." (one/prompt turn lavender) | #1F1413 |
| 5.00 | 1.10 | "Meet\|" typed on lavender | #BDAFF6 |
| 6.10 | 2.43 | Zaro mark, wordmark, mark morph | #E9E7E6 |
| 8.53 | 2.47 | "Build an app. / With a sentence.\|" | #514643 |
| 11.00 | 2.00 | prompt bar typed, icon chips, send, pointer | #EDECE5 |
| 13.00 | 2.87 | rebuilt app window fades in | #C1BFB0 |
| 15.87 | 4.07 | zoom into chat panel, "Let's add some agents" typed | #C1BFB0 |
| 19.93 | 2.53 | "Add in agents. / They keep it running.\|" + 4 agent chips | #514643 |
| 22.47 | 1.67 | agents list card | #EDECE5 |
| 24.13 | 1.07 | pipeline UI, pointer | #EDECE5/#FBFBFB |
| 25.20 | 1.67 | bar chart + donut | #FBFBFB |
| 26.87 | 1.47 | tooltip on pipeline | #EDECE5 |
| 28.33 | 1.67 | split: "Simple / to start." left, chat card typed right | #514643 \| #EDECE5 |
| 30.00 | 2.87 | split: "Powerful / to scale." + agent node cards | #514643 \| #EDECE5 |
| 32.87 | 0.93 | same split, nodes settle | #514643 \| #EDECE5 |
| 33.80 | 2.30 | "Connect yo\|" / "Connect your mes\|" over icon field | #EDECE5 |
| 36.10 | 2.10 | "Connect your file\|" / "Connect your tools.\|" | #EDECE5 |
| 38.20 | 1.80 | icon field holds, text held | #EDECE5 |
| 40.00 | 2.00 | "Chaos becomes context" dot-matrix dissolve | #EDECE5 |
| 42.00 | 1.00 | folder grid UI, pointer | #FFFFFF |
| 43.00 | 0.93 | "Connections" card, app icons, "+12 more" | #EDECE5 |
| 43.93 | 2.47 | "Ask anything. / Your files answer.\|" | #514643 |
| 46.40 | 1.80 | large prompt bar typed, pointer, push-in | #EDECE5 |
| 48.20 | 1.80 | TL;DR answer text | #EDECE5 |
| 50.00 | 2.00 | doc window UI | #FFFFFF |
| 52.00 | 2.93 | "Reading sources… Searching 2142 files" list + assets panel | #EDECE5 |
| 54.93 | 2.00 | split: "Works where you work" + phone mockup | #F9FAF7 \| #C1BFB0 |
| 56.93 | 1.67 | Slack message card in phone | #C1BFB0 |
| 58.60 | 1.90 | "You didn't just [thumb] build an app." | #3B302D |
| 60.50 | 2.50 | orbit of app thumbnails, particle field | #372C29 |
| 63.00 | 2.13 | "You grew a system." (system in lavender) | #201514 |
| 65.13 | 3.40 | end card: logo + "TRY FOR FREE AT ZARO.AI" | #EDECE5 |

Beat stats: **n=33, mean 2.08s, median 2.00s, under 1.5s: 6/33 = 18%, under 2.5s: 73%.**

Transition widths (frames above 0.05 around each boundary): hard cuts are 1 frame (8.53, 11.00, 22.47, 43.93, 46.40, 58.60). Soft swaps are 5 to 7 frames: 33.80 to 34.07 (5f, 170ms), 34.87 to 35.20 (6f, 200ms), 4.87 to 5.27 (7f). Rule observed: dark-to-light and light-to-dark are always hard cuts; light-to-light beats dissolve or swap elements on a held background.

Frame-rate note: in four 2s motion windows, 39% to 64% of consecutive 30fps frames are pixel-identical (25.2s: 39%, 61.0s: 44%, 57.0s: 51%, 9.5s: 64%). Zaro's animation is effectively ~15fps in a 30fps container. DashX windows: 0% to 24% identical, i.e. genuinely 60fps motion.

### DASHX, `select='gt(scene,0.25)'`

**Scene detection fails on this video.** Only two frames exceed 0.25 and both belong to one event (24.150: 0.355, 24.167: 0.537). Max score elsewhere is 0.136 (22.60, the blue flood). Counts above threshold (1800 frames): 0.02: 44, 0.05: 13, 0.10: 7, 0.25: 2. The whole 30s is a single continuous white canvas with elements animating on and off; there is exactly one hard cut.

Beat list from the 2fps sheet plus per-frame diff runs (0.5s resolution):

| start | dur | content |
|------:|----:|---|
| 0.00 | 2.10 | "Treasury: $1,248,400" tracks in from wide letter-spacing |
| 2.10 | 1.40 | green "Payout" button pops in, pointer moves, clicks |
| 3.50 | 4.70 | button flies out in 3D, rotates into a green pole |
| 8.20 | 2.60 | 3D world map drops in, employee name chips appear on the pole |
| 10.80 | 1.20 | map flattens to 2D, green arcs and chips |
| 12.00 | 2.65 | "Your salary is public to the whole world" tracks in, map turns dark red |
| 14.65 | 1.35 | white; "Private Payroll" wipes in L to R, blue then black |
| 16.00 | 0.70 | dashx logo lockup |
| 16.70 | 4.80 | "Add Employees" button, 4 pointer clicks, 4 avatars pop around it |
| 21.50 | 1.10 | "Toggle Privacy" switch flips, avatars blur into blue dots |
| 22.60 | 1.55 | blue floods the frame, "PAY PRIVATELY" button, pointer click |
| 24.15 | 0.45 | hard cut: giant grey letters zoom past (transition) |
| 24.60 | 4.40 | logo + "Private Payroll for Global Teams" + laptop mockup slides in, pointer |
| 29.00 | 1.00 | fade to #575757 then black |

Beat stats: **n=14, mean 2.14s, median 1.47s, under 1.5s: 7/14 = 50%, under 2.5s: 64%.**

---

## 2. Palette

Method: at each time, four 40x40 patches (TL, TR, BL, BR, 20px inset) area-averaged to one pixel each; "avg" is their mean. Four matching corners means a flat background.

### ZARO, shot midpoints of the 14 scene-detect shots

| t | avg | corners agree? | note |
|--:|---|---|---|
| 2.50 | #1F1413 | yes | near-black brown, grain texture |
| 6.75 | #EDECE5 | yes | cream |
| 9.75 | #514643 | yes | dark taupe |
| 15.50 | #C1BFB0 | yes | warm grey (the "sage") |
| 21.20 | #514643 | yes | |
| 25.40 | #FBFBFB | yes | white card fill (chart detail) |
| 30.60 | split | no: TL/BL #514643, TR/BR #EDECE5 | 50/50 vertical split |
| 38.40 | #EDECE5 | yes | |
| 45.20 | #514643 | yes | |
| 51.70 | #EDECE5 | ~ (BL #F9FAF7) | |
| 57.80 | #C1BFB0 | yes | |
| 61.80 | #3B302D | no: BL #D8D8D8 (a UI thumbnail) | |
| 65.10 | #EDECE5 | yes | |
| 66.80 | #EDECE5 | yes | |

Distinct backgrounds and usage (14 scene-detect shots; the split shot counted for both):
- **#EDECE5 cream**: 6 shots (6.75, 30.6R, 38.4, 51.7, 65.1, 66.8)
- **#514643 dark taupe**: 4 shots (9.75, 21.2, 30.6L, 45.2)
- **#C1BFB0 warm grey**: 2 shots (15.5, 57.8)
- **#1F1413 near-black**: 1 shot (open) plus the close ramp (#372C29 at 62.0, #2E2321 at 62.5, #201514 at 64.5, #1F1413 at 64.5)
- **#FBFBFB / #FFFFFF white**: 1 shot (25.4), also as card fills inside cream shots (40.5, 42.5)
- **#BDAFF6 lavender**: the "Meet" beat only (5.3: #C1B5F4, 5.8: #BDAFF6), about 1.1s
- **#3B302D**: 58.6 to 60.5 ("You didn't just build an app")

Accent (ink, not background): lavender **#BDB0F4** (mean of 75,391 lavender pixels on the "with one prompt" frame; caret mean #BDAEF4). Agent chips in the 19.93 shot: #FCCC54 amber, #84CC84 green, #9CE4E4 cyan, plus lavender.

**Alternation pattern (measured across the 13 boundaries):** 10 boundaries flip dark to light or light to dark (5.00, 8.53, 11.00, 19.93, 22.47, 43.93, 46.40, 58.60, 65.07/65.13 pair, 28.33 into split), 2 are partial (the split-screen shots at 28.33 and 32.87 keep dark on the left), 1 does not flip (56.93, light grey to light grey). So the alternation is **strict at the hard-cut level but the light side clusters**: every dark #514643 shot is a single two-line headline lasting 2.47 to 2.53s (three of them: 2.47, 2.53, 2.47), and every light run is a 6 to 11s demonstration in which cream, warm grey and white swap softly. Near-black #1F1413 is reserved for the opening statement (5.0s) and the closing statement (6.5s). Shape of the film: **black open, then four cycles of [2.5s dark headline, 6 to 11s light demo], then black close, cream end card.**

### DASHX, one sample per second

- **#FFFFFF**: 27 of 30 samples (0.5 to 22.5, 24.5 to 28.5). All four corners #FFFFFF except where the map or pole touches a corner (4.5 BL #1DF007, 8.5 TL #246B26, 9.5 BL #256B26).
- **#4D66F2 blue** (corners #455FF1 to #6077F4, a soft radial): 1 sample, 22.6 to 24.15 (1.55s).
- **#575757**: 29.5, the end fade.

Accent inks (dominant saturated pixels, 16-level quantisation): payout button **#18E808** (81% of saturated pixels at 2.6s); 3D map **#286828** (90% at 9.5s); map when "public" **#680808** (72% at 13.5s); brand blue **#4858F8** (77% at 17.5s on the button; 95% at 23.5s as the flood); logo bolt #3848B8 to #4858E8 gradient. "Private Payroll" at 15.0s: no saturated pixels, the wipe has already gone to black (#0C0C0C).

DashX does not alternate. It holds white for 75% of runtime and spends its single colour flood on the payoff button.

---

## 3. Shot types

Classification of the beat lists above (count share and time share):

| type | ZARO beats | ZARO time | DASHX beats | DASHX time |
|---|---:|---:|---:|---:|
| TYPE-ONLY | 5 (15%) | 11.0s (16%) | 4 (29%) | 6.6s (22%) |
| TYPE+CURSOR | 6 (18%) | 13.0s (19%) | 0 | 0 |
| UI-COMPONENT | 12 (36%) | 21.4s (31%) | 5 (36%) | 13.2s (44%) |
| UI-DETAIL | 6 (18%) | 13.0s (19%) | 1 (7%) | 4.7s (16%) |
| ICON-FIELD | 2 (6%) | 4.3s (6%) | 2 (14%) | 3.8s (13%) |
| CURSOR-ACTION (standalone) | 0 | 0 | 0 | 0 |
| LOGO | 2 (6%) | 5.8s (9%) | 2 (14%) | 1.7s (6%) |
| FOOTAGE | 0 | 0 | 0 | 0 |

Notes on the classification:
- CURSOR-ACTION never gets its own shot. The pointer appears inside UI-COMPONENT beats: Zaro in 5 beats (11.0, 24.13, 42.0, 46.4, 50.0), DashX in 5 of 14 beats (2.1, 16.7, 21.5, 22.6, 24.6) and DashX uses it as the primary actor (4 clicks on "Add Employees").
- Zaro's three split-screen beats (28.33 to 33.8, 54.93) are TYPE left / UI-COMPONENT right and are counted as UI-COMPONENT.
- Zaro's icon field is usually a background layer under TYPE+CURSOR (33.8 to 38.2) rather than a shot of its own; only 38.2 and the orbit at 60.5 are pure ICON-FIELD.
- DashX 3.5 to 8.2 (button flying in 3D into a pole) is classed UI-DETAIL; it is a single UI element isolated and transformed.

**Browser chrome: refuted for both.** Every frame in the 1fps and 2fps sheets plus four full-res checks (`motion-spec-data/chrome_check.jpg`: Zaro 14.5s, 40.5s, 51.0s; DashX 27.0s) shows no tab bar, URL bar or OS window controls. Zaro's app is a rebuilt window with its own sidebar and rounded frame on a flat bg; DashX's site sits inside a laptop bezel illustration. Real-world footage: none in either.

---

## 4. Typography

Method: full-res PNG, background from corner median, ink mask = colour distance > 60 (or 90 with a tight crop), first-glyph height from the leftmost connected column group of line 1.

### ZARO (frame height 2160px)

| t | line | first glyph | cap height | fraction of H | ink colours (quantised, share of ink) | bbox centre (x,y of frame) |
|--:|---|---|---:|---:|---|---|
| 2.5 | "Apps [chip] and [chip] agents" | A | 187px | **0.087H** | #E4E4E4 61%, #B4B4FC 23% (chips/accent) | (0.333, 0.491)* |
| 3.6 | "with one prompt." | w-group | 189px | 0.088H (x-height group, not a cap) | #E4E4E4 58%, #B4B4FC 25% | (0.510, 0.497) |
| 9.8 | "Build an app." / "With a sentence." | B | 206px | **0.095H** | line 1 #FCFCFC 95%; line 2 #9C9C9C 90% + #B4B4FC 4% (caret) | (0.507, 0.500) |
| 21.6 | "Add in agents." / "They keep it running." | A | 206px | **0.095H** | #9C9C9C 44%, #FCFCFC 31%, chips #FCCC54 / #84CC84 | (0.507, 0.500) |
| 28.8 | "Simple" / "to start." (left panel) | S | 179px | **0.083H** | #E4E4E4 91% line 1; line 2 same white | (0.249, 0.498), centred in the left half |
| 45.6 | "Ask anything." / "Your files answer." | A | measurement failed (descender of "y" bridged the two lines; single-glyph crop caught a stray) | line block 506px = 0.234H for two lines | #9C9C9C 51%, #FCFCFC 43% | (0.507, 0.500) |
| 63.6 | "You grew a system." | Y | measurement failed (particle field passes the ink threshold) | line height 253px = 0.117H | #FCFCFC 91% | (0.452, 0.511)** |

\* The chips at 2.5s share colour with the bg so the bbox excludes them; the visible composition is centred.
\*\* Particles widen the bbox; visually centred.

Findings: headline cap height is **0.083 to 0.095H** (179 to 206px at 2160; about 90 to 103px at 1080p). Two-line headlines, centred both axes (measured centre 0.507, 0.500 on three frames). **Two-tone is used on every two-line dark shot**: line 1 white (#FCFCFC), line 2 muted grey (#9C9C9C), exact same size, 9 to 30px line gap. On the near-black open/close the accent word turns lavender #BDB0F4 instead. Text is Inter-like grotesk, medium weight, tight tracking. Zaro also uses a dot-matrix display face once (40.0s, "Chaos becomes context") and a small monospace caption on the end card.

**Typing cursor (Zaro):** a solid vertical bar, lavender **#BDAEF4**, 28px wide x 234px tall at 4K (0.108H, i.e. the full ascender-to-descender height, taller than the cap height), no rounding visible at this size, sits ~1 caret-width after the last glyph. Behaviour from 30fps tiles (`z_typing_9s.jpg`, `z_typing_36s.jpg`):
- Text types **character by character**. New characters land every 2 to 4 container frames (9.3s window: frames 1, 5, 7, 11, 13, 17, 19 for "n t e n c e ." = 7 chars in 18 frames = **11.7 cps**; 35.9s window: "o", "l", "s." at frames 1, 3, 5 = **15 cps** with a final two-character drop). Cadence is irregular on purpose. Given the 15fps effective rate the minimum gap is one unique frame (67ms).
- The caret **does not blink while typing**. After the last character it holds solid for **~20 frames (0.67s)**, then goes off for ~21 frames, then on again: a blink period of ~1.4s at 50% duty, hard on/off with no fade. Both tiles show the same 20 to 22 frame holds.
- The whole line is present from frame 0 of the shot at its final position; nothing slides. Typing is the only motion in a TYPE+CURSOR shot.

### DASHX (frame height 1440px)

| t | text | first glyph | cap height | fraction of H | ink |
|--:|---|---|---:|---:|---|
| 3.0 | "Treasury: $1,248,400" | T | 72px | **0.050H** | #0C0C0C |
| 15.5 | "Private Payroll" | P | 72px | **0.050H** | #0C0C0C 43% + blue remnants #0C0C24 / #0C0C3C |
| 16.7 | dashx lockup | d | 221px | 0.154H (logo, not headline) | #242424 + bolt #3C54B4 |
| 13.5 | "Your salary is public / to the whole world" | two lines | block 144px = 0.100H | small under the map | #0C0C0C |

Centred (0.500, 0.502). Single colour, black on white; no two-tone. Font is a heavy grotesk (Helvetica-Bold-like). **No typing cursor anywhere in DashX.** Its text entrances are:
- Tracking-in: "Treasury" starts as a row of dots at very wide letter-spacing and collapses to normal over ~40 frames at 30fps sampling (**~1.3s**), fading in at the same time, ease-out (diff bell peaks at +50 of 84 frames at 60fps then decays).
- Wipe: "Private Payroll" reveals left to right with a blur and a blue tint over **6 frames at 30fps (200ms)**, then the colour settles blue to black per letter over the next ~18 frames (600ms). Whole reveal ~0.8s.

---

## 5. Motion (entrances)

Method: per-frame mean absolute luminance difference on 480px frames (region-restricted where a split frame). "Unique frames" for Zaro counts non-duplicate frames (15fps effective). A monotonically decreasing diff series = deceleration (ease-out). A rise after settle = overshoot or the next element.

### ZARO

| t | element | shape of diff series | duration | easing | overshoot |
|--:|---|---|---|---|---|
| 22.47 | agents list card after hard cut | 3.00, 2.03, 1.43, 1.12, 0.85, 0.65, 0.52, 0.39, 0.29, 0.18, 0.11, then 0.02 | 11 unique frames = 22 container = **733ms** | pure ease-out, exponential decay from frame 1 | none (series never rises again until the next element at +1.1s) |
| 56.93 | phone mockup | 6.95, 5.36, 4.44, 3.21, 2.22, 1.98, 1.58, 1.14, 0.64, 0.21, 0.05 | 11 unique = **733ms** | ease-out, fastest on frame 1 | none |
| 43.93 | "Connections" card | 4.20, 3.42, 2.42, 2.28, 1.69, 1.72, 1.46, then 1.0 to 1.9 sustained | ~8 unique = **533ms** to settle, then continuous icon motion | ease-out | none; the sustained 1.0 to 1.9 is the icon row and "+12 more" animating |
| 28.33 | chat card, right half of the split | 1.94, 2.07, 1.88, 1.43, 1.05, 0.72, 0.58, 0.43, 0.68, 0.54, 0.30, 0.23, 0.20 | ~10 unique = **667ms** | short ease-in (peak at unique frame 2) then ease-out | small secondary bump (0.43 to 0.68) at frame 9, consistent with a child (the typed line) starting, not a spring |
| 25.2 | bar chart, then donut | 18.2 (appear), 3.28, 3.04, 2.62, 2.33, 2.03, 3.59, 1.62, 1.39, 1.21, 1.11, 1.07, 0.90, then 6.86 (donut), 3.20, 2.21, 1.39, 0.91, 0.54 | bars ~13 unique = **870ms**; donut enters at +930ms and settles in 6 unique = 400ms | ease-out on both | none. Children are **staggered**: donut starts after the bars finish |
| 46.40 | large prompt bar after hard cut | 3.09, 2.60, 3.13, 3.30, 3.51, 3.28, 4.18, 4.71, 5.44, 6.38, 5.70, 3.81, then 15.85 (dissolve to next) | 10 unique = **667ms** accelerating into the transition | **ease-in** (a push-in/zoom that speeds up, then dissolves) | n/a |
| 11.00 | small prompt bar after hard cut | 0.38, 0.29, 0.14, 0.12, 0.09, 0.09, 0.07, 0.06 then 0.24 to 0.43 (typing) | 8 unique = 533ms | ease-out | none |
| 23.0 to 24.13 | type shot leaving | 0.07 rising steadily to 1.86 over 14 unique frames, then a 17.66 dissolve | ~930ms | **ease-in exit** | n/a |

Zaro grammar in numbers: entrances are **530 to 870ms ease-out with no overshoot**; children stagger (chart then donut, card then typed line); exits and push-ins are **ease-in over 670 to 930ms** and end in a 1-frame cut or a 5 to 7 frame dissolve. Nothing springs.

### DASHX (60fps)

| t | element | diff series (60fps) | duration | easing | overshoot |
|--:|---|---|---|---|---|
| 2.1 | "Payout" button | 2.06, 2.41, 2.85, 3.24, 3.53, 3.50, 3.07, 2.35, 1.71, 1.20, 0.80, 0.49, 0.26, 0.08, 0.00 | **14 frames = 233ms** | symmetric bell, ease-in-out, peak at frame 4 | none |
| 16.2 | "Add Employees" click | 4.17, 5.61, 3.34, then 0.86, 0.70, 0.96, 1.26, 1.71, 2.28, 2.54, 2.23, 1.58, 0.96, 0.43, 0.13 | 3-frame press (50ms) + 12-frame release bell (200ms) | press is near-instant, release is a bell | a click feedback that rebounds: this is the one overshoot-like shape in either video |
| 17.8 | avatar 1 / pointer travel | plateau 0.64 to 0.57 for 18 frames then 0.02 | **18 frames = 300ms** | **linear** (constant velocity, abrupt stop) | none |
| 18.9 | avatar 2 pop | 1.22, 2.00, 1.98, 1.80, 1.74, 1.62, 1.50, 0.81, 0.72, 0.57, 0.27, 0.10 | **~10 frames = 170ms** | fast in, ease-out | none |
| 21.0 | toggle knob | plateau 1.48 to 1.53 for 11 frames then 0.5 | **11 frames = 183ms** | **linear** | none |
| 22.5 | blue flood | 2.59, 5.08, 16.0, 21.4, 37.2, 53.1, 7.84, 0.26 | **6 frames = 100ms** | ease-in (accelerating wipe) | none |
| 24.13 | laptop mockup slide-in | 1.05 to 8.9 ramp over 8 frames, plateau ~8.8 for 12 frames, decay to 0 over 10 frames | **34 frames = 567ms** | ease-in-out (8f in, 12f linear, 10f out) | none |
| 0.3 | "Treasury" track-in | smooth bell peaking at frame 50 of 84 | ~1.3s | sine-like ease-in-out | none |

DashX grammar in numbers: UI elements arrive in **100 to 233ms** (very fast, ease-in-out or ease-out); pointer and knob moves are **linear 180 to 300ms**; the only slow entrances are text (1.3s track-in) and the final mockup (567ms). No springs; the one rebound is click feedback.

---

## 6. Audio

Method: `volumedetect` on the full mix, on `lowpass=f=90`, and on a 300 to 3400Hz voice band; `silencedetect=n=-35dB:d=0.4`; mlx_whisper base for narration; `astats` RMS per 1/30s on a 120Hz low-pass for onsets.

| | ZARO | DASHX |
|---|---|---|
| full mix mean / max | -10.4 dB / 0.0 dB | -11.9 dB / 0.0 dB |
| sub-90Hz mean / max | -13.3 dB / -1.1 dB | -15.0 dB / -0.1 dB |
| voice band 300 to 3400Hz mean | -17.9 dB | -18.1 dB |
| silence (< -35dB for 0.4s) | one gap, 4.45 to 4.88s (0.43s), right before the "Meet" cut | none |
| whisper transcript | full narration, 13 segments, 29.6s of speech = 43% of runtime | empty (no speech detected) |

**ZARO = narration + music.** Narration text matches the on-screen headlines word for word ("Apps and agents with one prompt." … "Don't start from zero. Start with Zaro."). Cut-to-narration alignment (whisper segment starts, ±0.3s timing accuracy): 5.00 cut / "Meet" 5.28; 8.53 / "Build" 8.08; 19.93 / "Add" 19.50; 32.87 / "Connect" 33.14; 43.93 / "Ask" 43.98; 58.60 / "You didn't" 58.22; 65.07 / "Don't start" 64.76. Seven of the twelve hard cuts sit within 0.5s of a narration phrase onset; every dark headline shot begins within 0.45s of its spoken line.

**DASHX = music only.**

**Beat lock: not found in either.** Low-band onset autocorrelation gives no dominant lag (Zaro top candidates 0.93s, 0.70s, 1.03s; DashX 1.30s, 0.37s, 0.93s). Fitting a beat grid to the onsets gives a best mean phase error of 0.197 (Zaro, 113 BPM) and 0.186 (DashX, 105 BPM), where 0.25 is random; both are weak. Zaro cuts against the 113 BPM grid: 4 of 12 within 60ms, the rest 120 to 245ms off, i.e. chance level. Zaro's low-band onsets do repeat a 3.7s phrase (3.03, 7.07, 10.77, 14.47, 18.13) so the bed is a loop, but the cuts follow the voice, not the loop. DashX onsets are sparse (30 in 30s) and its three hard events sit 170 to 380ms from the nearest onset. **Neither video cuts on the beat.**

---

## What to copy for SEALED

Brand: bg #0B0B0D near-black, gold #C9A24B, cream. Target ~40s, 1080p or 4K at 30fps (render true 30fps; Zaro's duplicated frames are a defect, not a style).

1. **Palette rotation, from Zaro's measured dark/light alternation (10 of 13 hard cuts flip; dark headline shots are 2.47 to 2.53s each; light runs are 6 to 11s).** Invert the roles for Sealed: the *default* canvas is near-black #0B0B0D (Zaro's #514643 slot), the *demonstration* canvas is cream (Zaro's #EDECE5), and gold #C9A24B is ink only, never a background, used the way Zaro uses lavender #BDB0F4 (the accent word, the caret, chips). Budget for 40s: open on #0B0B0D 4s, then three cycles of [2.5s black headline, 6 to 7s cream demo], then 4s black close, 3s cream end card. That is 7 hard cuts, all of them dark-to-light or light-to-dark. Inside a cream run, swap elements with 5 to 7 frame dissolves (170 to 230ms) on a held background; never hard-cut cream to cream. One colour flood is allowed, DashX-style (its blue holds 1.55s = 5% of runtime): a single gold flood behind the sealing action, 1.5s, once.

2. **Shot-type budget, from the measured splits (Zaro by time: UI-COMPONENT 31%, TYPE+CURSOR 19%, UI-DETAIL 19%, TYPE-ONLY 16%, LOGO 9%, ICON-FIELD 6%; DashX: UI-COMPONENT 44%, TYPE 22%).** For 40s: UI-COMPONENT 13s, TYPE+CURSOR 8s (three 2.5s black headlines plus one prompt line), UI-DETAIL 7s (one zoomed balance/receipt element, one chart), TYPE-ONLY 5s (open and close statements), LOGO 4s, ICON-FIELD 2s (the counterparties/rails field, under a headline, not its own shot), FOOTAGE 0s, browser chrome 0 frames. The pointer lives inside UI shots and clicks the thing that matters (DashX: 4 clicks in one 4.8s beat), never in a shot of its own.

3. **Beat length, from the beat stats (Zaro mean 2.08s, median 2.00s, 18% under 1.5s; DashX mean 2.14s, median 1.47s, 50% under 1.5s).** Plan ~19 beats in 40s: mean 2.1s, median 2.0s, no beat under 0.9s except one transition flash, no beat over 4.5s. Headline beats are exactly 75 frames (2.5s). Demo beats are 1.0 to 2.9s each, and a demo run is 3 to 4 beats long.

4. **Typing, from the 30fps tiles (7 chars in 18 frames = 11.7 cps; 15 cps at the end of a line; caret holds 20 frames then blinks at ~1.4s period, 50% duty, hard on/off).** Type character by character at 11 to 12 cps with a random 2 to 4 frame gap per character (never a fixed interval), drop the final two characters of a line together, and finish every headline with the caret solid for 20 frames then blinking at 21 on / 21 off. Caret: a solid bar the full ascender-to-descender height (0.108H at 4K, i.e. 233px at 2160 / 117px at 1080), 28px wide at 4K (14px at 1080), gold #C9A24B on black, near-black on cream. Two-line headlines at cap height 0.083 to 0.095H (90 to 103px caps at 1080p), centred both axes, line 1 cream #F2EFE6-class white, line 2 muted (Zaro's #9C9C9C on #514643 is a 3.2:1 ratio; on #0B0B0D use ~#8A8680). The text is on screen at its final position from frame 0; only the characters appear. For the one number that must land (the sealed amount), use DashX's tracking-in instead: letter-spacing from very wide to normal with a fade over 1.3s, ease-out.

5. **Entrance timing, from the diff series (Zaro cards 533 to 870ms ease-out, no overshoot; children staggered; DashX buttons 100 to 233ms; pointer and knob moves linear 180 to 300ms).** Cards and components: 20 frames (667ms) ease-out from the first frame after the cut, opacity plus 24px upward travel plus scale 0.96 to 1.00, cubic-out, zero overshoot, no spring. Children stagger by 8 to 10 frames and each child uses the same 20-frame ease-out (Zaro's donut starts 930ms after the bars start). Buttons and chips inside a live component: 7 frames (233ms) ease-in-out. Pointer travel: linear, 9 to 18 frames, then a 3-frame press and a 12-frame release bell on click (DashX's one rebound). Exits: ease-in over 20 to 28 frames into a 1-frame cut (Zaro's push-in accelerates for 667ms before its dissolve). Never ease-out an exit.

6. **Audio and cut logic, from the silence/whisper/onset tests (Zaro cuts sit within 0.5s of narration phrase onsets for 7 of 12 cuts; neither video locks cuts to a music beat; Zaro leaves one 0.43s silence before its "Meet" reveal).** Write the narration first and cut on phrase onsets: each black headline starts 0 to 300ms before its spoken line. Keep the music bed under the voice by ~7dB (Zaro voice band -17.9dB vs sub-90Hz -13.3dB with the mix peaking at 0dBFS), use a loop with a 3 to 4s phrase, and do not chase its beat with the edit. Put one deliberate 0.4s silence immediately before the logo reveal. If there is no narration, do what DashX does: music only, and let text tracking-in and the single colour flood carry the emphasis instead.

Blind spots: Zaro beat boundaries are read at 0.5s resolution from a 1fps sheet where they were not hard cuts; DashX beat boundaries likewise from a 2fps sheet. Two of the six Zaro cap-height measurements failed (descender bridge, particle bg) and are marked as such. Whisper base timestamps are ±0.3s. Beat tempo was estimated from a low-band envelope, not a full onset detector; the conclusion "no beat lock" rests on the cuts being at chance distance from the best-fit grid.
