# Voice options for the Sealed launch video

Written 2026-09-05 after two rejections of the narration as "too AI". Every number below
carries the command or URL that produced it. Nothing was generated, downloaded or installed
while writing this.

## Verdict first

**The fix is the reference, not the knobs.** Every h-line was cloned from `~/vo-fix/ref.wav`,
which is itself a 4.3 s OmniVoice voice-design output; the clones came out flatter than that
reference (median pitch SD 1.54 st vs 2.55 st) with no sentence pauses in 10 of 15 lines. The
engine's own docs say the reference clip is the prosody control ("a flat reference clones
flat, an animated one clones animated"). A real human recording is the one input that has not
been tried.

**Recommended path: Chatterbox on the mini via the already-installed mlx-audio 0.5.0, cloning
a public-domain LibriVox reader (Elizabeth Klett, section 2).** Needs from the user: nothing.
No API key. No pip install. It does need one model download (`mlx-community/chatterbox-fp16`,
2.58 GB Apache-2.0, plus `mlx-community/S3TokenizerV2`, 0.49 GB) and the 10 s reference cut.

Why not simply put the human reference into OmniVoice, which is already loaded: OmniVoice's
weights are CC-BY-NC by its own README ("The pre-trained model is licensed under the CC-BY-NC
due to constraints from its training data"), and this is a commercial product's launch video.
Chatterbox weights are MIT, its mlx conversion Apache-2.0, and it exposes an `exaggeration`
prosody knob OmniVoice lacks. OmniVoice with the human clip is still worth 60 seconds as a
diagnostic (command in the ranking), just not as the shipped voice. Hosted vendors all need a
key; the one whose free tier is commercial and top 10 on both arenas is Inworld (section 3).

First command to try (on the mini, after cutting the reference; the cut and transcript are
the only manual steps):

```bash
# 1. cut a 10 s animated passage from the public-domain LibriVox file, 24 kHz mono
ssh mini-ts 'mkdir -p ~/vo-fix/human && cd ~/vo-fix/human && \
  curl -sL -o klett-preface.mp3 https://archive.org/download/twentyyearsathullhouse_1012_librivox/twentyyearsathullhouse_00_addams.mp3 && \
  ffmpeg -y -v error -ss 00:00:20 -t 10 -i klett-preface.mp3 -ac 1 -ar 24000 ref-human.wav'
#    listen to ref-human.wav once, move -ss until the passage is lively and mid-sentence-free,
#    then type its exact words into REF_TEXT below.

# 2. first line through Chatterbox (mlx-audio CLI; downloads the two repos on first run)
ssh mini-ts 'cd ~/VoiceStudio && .venv/bin/python -m mlx_audio.tts.generate \
  --model mlx-community/chatterbox-fp16 \
  --ref_audio ~/vo-fix/human/ref-human.wav \
  --ref_text "<exact transcript of the 10 s cut>" \
  --text "Salary. Rent. Last night." \
  --exaggeration 0.5 --temperature 0.8 \
  --output_path ~/vo-fix/human --file_prefix h02-cbx --audio_format wav'
```

Flag notes from the installed source (`mlx_audio/tts/generate.py`, `models/chatterbox/chatterbox.py`):
`--exaggeration` reaches the model (mlx port default is 0.1, upstream README default 0.5,
"0.7 or higher" for expressive); `--cfg_scale` is forwarded as `cfg_scale` and swallowed by
`**kwargs`, so `cfg_weight` stays at 0.5 from the CLI; the decoder conditions on at most 10 s
of reference (`DEC_COND_LEN = 10 * 24000`), so a longer clip buys nothing. Output is 24 kHz
and carries Resemble's Perth watermark.

Then run the check that can fail:

```bash
ssh mini-ts '~/VoiceStudio/.venv/bin/python /tmp/prosody_ref.py \
  ~/vo-fix/human/h02-cbx*.wav ~/vo-fix/human/ref-human.wav ~/vo-fix/ref.wav'
```

Pass condition: pitch SD of the new line at or above 2.5 semitones (the read-speech figure in
Traunmüller and Eriksson's Table I, section 1) and at least one pause of 150 ms or more between
the three sentences. The current h02 measures 0.54 st and zero pauses, so the check is red
today. If the human reference itself measures under 2.5 st, pick a livelier passage before
blaming the engine; if the reference passes and the clone fails, move to option 3 (Inworld).

---

## 1. What is actually wrong with h01 to h15, measured

### Provenance (mini, `~/vo-fix/`)

- `hero.txt` holds the 15 hero lines; `lines*.txt` the earlier s-series scripts.
- `ref.wav`: 4.32 s, 24 kHz mono PCM16, written 30 Aug 12:59, the same minute as `h1.wav`.
  There is no human recording anywhere in `~/vo-fix`, `/tmp`, or the OmniVoice prompt cache
  (`~/Library/Application Support/OmniVoice/prompt_cache/` holds two encoded prompts, 29 Aug and
  1 Sep). The clone chain was: `--instruct "female, young adult, american accent, moderate
  pitch"` design line, then that line as `--ref_audio` for the h-series.

### Prosody (librosa 0.11 pyin, 120 to 450 Hz, hop 256; pauses = RMS below -30 dB re peak for
150 ms or more, edges trimmed; run on the mini via `/tmp/prosody.py`)

| file | dur s | voiced % | F0 median Hz | F0 SD (st) | F0 5-95 range (st) | pauses >=150ms |
|---|---|---|---|---|---|---|
| ref.wav (the AI reference) | 4.32 | 34.2 | 183 | 2.55 | 8.21 | n/a |
| h01 | 2.68 | 34.5 | 169 | 1.36 | 3.84 | 0 |
| h02 | 1.92 | 24.9 | 169 | 0.54 | 1.74 | 0 |
| h03 | 2.16 | 35.0 | 172 | 0.83 | 2.70 | 0 |
| h04 | 2.52 | 49.8 | 181 | 2.71 | 8.12 | 0 |
| h05 | 2.88 | 39.1 | 167 | 2.42 | 7.22 | 0 |
| h06 | 3.48 | 36.4 | 182 | 1.86 | 5.82 | 1 (0.21 s) |
| h07 | 2.84 | 33.3 | 177 | 1.47 | 4.40 | 0 |
| h08 | 1.80 | 26.0 | 167 | 0.95 | 2.68 | 0 |
| h09 | 2.28 | 37.9 | 183 | 1.76 | 5.50 | 0 |
| h10 | 4.04 | 29.8 | 178 | 1.45 | 4.34 | 1 (0.23 s) |
| h11 | 2.92 | 42.0 | 168 | 2.68 | 9.23 | 0 |
| h12 | 4.56 | 38.6 | 172 | 1.78 | 6.76 | 1 (0.21 s) |
| h13 | 4.12 | 35.7 | 177 | 2.08 | 7.33 | 1 (0.19 s) |
| h14 | 4.16 | 25.8 | 185 | 1.48 | 4.20 | 1 (0.19 s) |
| h15 | 2.84 | 34.8 | 184 | 1.54 | 4.70 | 0 |

Summary of the 15 hero lines: F0 SD median **1.54 st**, mean 1.66 st, range 0.54 to 2.71 st;
only 3 of 15 reach 2.4 st and none reach 3. Ten of fifteen contain no internal pause of 150 ms
or more; the five that do pause for 0.19 to 0.23 s once. Lines written as three sentences
("Salary. Rent. Last night.", "Every amount. Every name. Forever.") render with zero pauses.
Words per second across the 15 lines (hero.txt word counts over measured durations): 2.1 to
3.7, mean 3.1 (about 186 wpm).

Baseline for comparison: Traunmüller and Eriksson (1995), Table I, tabulates F0 SD in
semitones by discourse type; read or neutral speech sits around 2.5 st and livelier speech at
3 to 4 st, with the SD rising with liveliness and doing so more in women's speech
(https://www.academia.edu/24733034/The_frequency_range_of_the_voice_fundamental_in_the_speech_of_male_and_female_adults,
abstract and Table I excerpt read via search snippet, not the full PDF; the Stockholm host
`www2.ling.su.se` no longer resolves). Twelve of our fifteen lines sit below the read-speech
figure, and the clone came out flatter than its own reference (median 1.54 st vs 2.55 st).

Blind spot: there is no human recording of these exact lines to compare against, and pyin on
1.8 to 4.6 s clips has wide variance; the 2.5 st figure is a population read-speech value, not a
threshold from our own failing case. The pause count is the more robust tell.

### What the engine's own docs say about each knob (mini, `~/VoiceStudio/docs/`)

Source: `docs/generation-parameters.md`, `docs/expressive-speech.md`, `docs/engines/omnivoice.md`,
`README.md`, plus `omnivoice/cli/infer.py` for CLI types.

| knob | default | docs' own guidance | effect on the "AI" reading |
|---|---|---|---|
| `--ref_audio` | none | "3 to 10 seconds is the sweet spot"; README FAQ: "Use 5 to 15 seconds of one speaker, close to the microphone, without music, noise, or reverb. Match the tone and pace you want in the output." | The primary control. expressive-speech.md: "Zero-shot cloning mirrors the delivery of the reference, not just the timbre: a flat reference clones flat, an animated one clones animated. This is the most reliable expressive control in the app." |
| `--ref_text` | none (optional) | "A transcript of the clip improves conditioning"; with a transcript the clip is capped at 20 s; without one the app transcribes it | Supply it. Our ref had none in the CLI path. |
| `--instruct` | none | Fixed vocabulary only (gender, age, pitch, `whisper`, accent); "free-form design prose is mapped onto those attributes, and wording outside them is ignored". Can be combined with `ref_audio`; on conflict the reference wins. | Voice design cannot be steered toward natural prosody; there is no style axis other than whisper. |
| `--num_step` | 32 | "Higher values improve quality but slow down generation. Use 16 for faster inference." Voice page defaults to 16, Audiobook to 32. "Fewer steps = rougher, occasionally more human-sounding edges." | Keep 32 for clean; 16 is not a naturalness fix. |
| `--guidance_scale` | 2.0 | "Classifier-free guidance scale." No further guidance in docs. | Untested by the docs; no naturalness claim either way. |
| `--class_temperature` | 0.0 (greedy) | "Higher is more random, which means more expressive variation and more artifacts." Coax-it recipe: raise to 0.3 to 0.7 and farm takes; "temperature cuts both ways (slurred words, timbre drift)". | The one sampling knob the docs tie to expressiveness. We shipped at 0.0. |
| `--position_temperature` | 5.0 | Mask-position sampling randomness; 0 = deterministic. | Not documented as a naturalness lever. |
| `--t_shift` | 0.1 | "Time-step shift for the noise schedule. Smaller values emphasise earlier steps." | No naturalness guidance. |
| `--speed` | 1.0 | Duration scaling; `--duration` overrides it. | Slowing to 0.9 to 0.95 would bring 186 wpm toward read-speech pace but does not add pauses. |
| `--postprocess_output` | true | "Apply post-processing to generated audio (remove long silences)"; "Turn it off when the silence is the performance." | Default on. Any pause the model produced between sentences was trimmed. CLI parses `str2bool`, so `--postprocess_output false`. |
| `--denoise` | true | Prepends a denoise token for "cleaner speech". | Neutral. `str2bool`. |
| `[pause 500ms]` tags | | Stitched silence, "works identically on all engines" | Only in the VoiceStudio backend pipeline, not in `omnivoice-infer`. For the CLI, render sentences as separate files or turn postprocess off. |

### Does cloning a real human beat voice design? What the docs claim, and what we have not measured

The docs make the claim three times (generation-parameters.md tip, expressive-speech.md
"reference clip is a performance direction", engine-acceptance.md lists "Best zero-shot clone
quality: omnivoice"). VoiceStudio's eval harness (`docs/evaluation.md`) scores WER, speaker
similarity and UTMOS, but `docs/benchmarks.md` has "No verified rows yet". So there is no
in-repo number showing human-ref clones score higher UTMOS than design output. The
measurement above is the test: our AI-ref clone lost pitch variance relative to its own
reference, which is the direction the docs predict.

### Other engines on the mini (Apple M4, 16 GB, macOS 26.2)

`~/VoiceStudio/backend/engines/` has adapters for confucius4, dots_tts, indextts, moss_tts_v15,
omnivoice_gguf, omnivoice_subprocess, pockettts, supertonic3. None of their weights are
downloaded. Weights actually present in `~/.cache/huggingface/hub`:

| repo | size | usable now? |
|---|---|---|
| k2-fsa/OmniVoice | 2.3 GB | yes, the current engine |
| ResembleAI/chatterbox (t3_cfg 2.13 GB, s3gen 1.06 GB, ve, conds, tokenizer) | 3.0 GB | weights only; `import chatterbox` fails in the venv (no `chatterbox-tts` package) |
| eustlb/higgs-audio-v2-tokenizer | 768 MB | tokenizer only |
| whisper-large-v3-turbo (mlx and openai) | 1.5 GB each | ASR |

Installed Python packages relevant to TTS: `mlx-audio 0.5.0`, `kittentts 0.8.1`. mlx-audio
0.5.0 ships model modules for `chatterbox`, `chatterbox_turbo`, `kokoro`, `dia`, `sesame`
(CSM), `indextts`, `voxcpm2`, `omnivoice`, `moss_tts`, `qwen3_tts`, `higgs_audio` and about
30 others, and its CLI (`python -m mlx_audio.tts.generate`) exposes `--ref_audio`,
`--ref_text`, `--exaggeration`, `--cfg_scale`, `--temperature`. But its Chatterbox loader
wants mlx-format `model.safetensors` from `mlx-community/chatterbox-fp16` (2.58 GB,
Apache-2.0) or `mlx-community/chatterbox-multilingual-v3` (2.71 GB, MIT) plus
`mlx-community/S3TokenizerV2` (0.49 GB); the cached ResembleAI PyTorch weights would need
`scripts/convert.py`, whose header lists `onnx` and `s3tokenizer` as conversion-only
requirements, i.e. an install. `docs/engines/mlx-audio.md` also says cloning is confirmed only
for the `csm` model in that adapter; Chatterbox cloning there goes through the mlx-audio CLI
directly, not through VoiceStudio.

Naturalness evidence for Chatterbox: HF TTS Arena V2 places Chatterbox at #28, Elo 1478;
Kokoro at #30, 1475 (read 2026-09-05 from
https://tts-agi-tts-arena-v2.hf.space/api/leaderboard). Artificial Analysis places Chatterbox
at #73, 1021 (https://artificialanalysis.ai/text-to-speech/leaderboard). Resemble's "63.75%
preferred over ElevenLabs" comes from a Resemble-commissioned Podonos test over 8 samples,
and Resemble's own comparison page gives the mean score as -0.64 on a -2 to +2 scale, where
negative favours ElevenLabs (https://www.resemble.ai/resemble-ai-vs-elevenlabs,
https://www.resemble.ai/learn/models/chatterbox). OmniVoice, F5-TTS, Dia, Orpheus, CosyVoice,
IndexTTS, MOSS-TTS, Supertonic, Dots and Pocket TTS are on neither arena. Chatterbox's
`exaggeration` knob (docs: default 0.5, "for expressive speech try cfg_weight about 0.3 and
exaggeration 0.7 or higher", https://github.com/resemble-ai/chatterbox) is the only explicit
prosody-intensity control among the engines within reach, and every Chatterbox output carries
the Perth watermark.

Engines with better expressive control per VoiceStudio's own docs (CosyVoice 3 for
`[breath]`, IndexTTS 2.5 for graded emotion) are all "clone + install" and IndexTTS 2.5 carries
the bilibili Model Use License with a 100M-user clause (`docs/engines/indextts.md`). None are
present.

---

## 2. Free-licensed real human reference audio (not downloaded yet)

Target: one speaker, 5 to 15 s (OmniVoice README: "Use a 3 to 10 seconds reference audio
clip. Longer audio slows down inference and may degrade cloning quality"; Chatterbox README
example uses a 10 s clip), close-mic, no music, with a transcript, female young-adult American
English to match the current brief, male options listed.

| source | exact file | licence | speaker | length / rate | transcript | login |
|---|---|---|---|---|---|---|
| **LibriVox, "Twenty Years at Hull-House" (Jane Addams), solo read by Elizabeth Klett** | Preface, 4:17: https://archive.org/download/twentyyearsathullhouse_1012_librivox/twentyyearsathullhouse_00_addams_64kb.mp3 (drop `_64kb` for the 128 kbps VBR). Item: https://archive.org/details/twentyyearsathullhouse_1012_librivox | Public domain; item `licenseurl` http://creativecommons.org/publicdomain/mark/1.0/ ; LibriVox: "all our recordings are public domain, anyone can use all our recordings however they wish" https://librivox.org/pages/public-domain/ | female, American English, narration register | chapters 4 to 31 min, cut any 10 s; 44.1 kHz mono MP3 (LibriVox spec https://wiki.librivox.org/index.php?title=Tech_Specs) | Gutenberg text of the book, chapter-level not time-aligned; type the 10 s passage by hand | no |
| LibriVox, "The Time Machine" v2, solo read by Mark F. Smith | https://archive.org/download/time_machine_ms_librivox/timemachine_01_wells_64kb.mp3 (21:42); item https://archive.org/details/time_machine_ms_librivox | `licenseurl` http://creativecommons.org/publicdomain/zero/1.0/ | male, American English | 13 to 22 min chapters, 44.1 kHz MP3 | Gutenberg text | no |
| Hi-Fi TTS (NVIDIA) | https://www.openslr.org/109/ ; per-clip playable rows https://huggingface.co/datasets/MikhailT/hifi-tts/viewer/clean/train | CC BY 4.0 (OpenSLR page; paper https://arxiv.org/abs/2104.01497) | 10 LibriVox readers, 6 F / 4 M; clean set: 92 Cori Samuel F, 6097 Phil Benson M, 9017 John Van Stan M | segments up to about 20 s, many 10 to 20 s; 44.1 kHz FLAC | yes, normalized and raw | no |
| LJ Speech 1.1 | https://keithito.com/LJ-Speech-Dataset/ | public domain (page: "License: Public Domain") | single female, American English, read non-fiction | 1.1 to 10.1 s, mean 6.6 s; 22,050 Hz 16-bit mono | yes, per clip | no, but 2.6 GB tarball only |
| Mozilla Common Voice Scripted 26.0 English | https://mozilladatacollective.com/datasets/cmqim2hn800ssnr07gvmpcnwu | CC0-1.0 with "agree to not determine the identity of speakers"; some derived subsets add no-rehost or no-cloning clauses | 100k crowd speakers, mixed | avg 5.27 s, 10 to 30 s clips are rare outliers; MP3 | yes, one sentence per clip | yes, account and terms; the HF mirror `mozilla-foundation/common_voice_17_0` is now empty ("exclusively available through Mozilla Data Collective") |
| Freesound 653471 | https://freesound.org/s/653471/ | CC0 | "buggly", tagged american, english, female; a monologue | 29.7 s, 44.1 kHz mono M4A (lossy) | no | yes |
| Freesound 837664 | https://freesound.org/s/837664/ | CC0 | "clear English narration", ad read, gender not stated | 46.4 s, 48 kHz stereo M4A | no | yes |

Not usable: Expresso (cc-by-nc-4.0), the F5-TTS bundled `basic_ref_en.wav` (no provenance or
licence for the clip itself; F5 models are CC-BY-NC), IndexTTS demo `voice_0N.wav` (Space is
Apache-2.0 for the repo, speaker rights undocumented), VCTK (CC BY 4.0 but 2 to 6 s
sentences and few American speakers). Chatterbox and OmniVoice ship no example wav.

Pick: the Elizabeth Klett preface. Public domain, a professional-sounding solo female
American reader, and a 4-minute file gives dozens of candidate 8 to 12 s passages to choose an
animated one from (the reference's delivery is what gets cloned). Cut with ffmpeg to 24 kHz
mono WAV and type the transcript of the exact cut as `--ref_text`.

Blind spot: nothing was listened to; gender, accent and cleanliness for each row come from
metadata, tags and the LibriVox spec.

### Licence of the engine itself

OmniVoice's own README, line 783 (https://huggingface.co/k2-fsa/OmniVoice/raw/main/README.md):
"Our code is released under the Apache 2.0 License. The pre-trained model is licensed under
the CC-BY-NC due to constraints from its training data (e.g., Emilia)." VoiceStudio's
`LICENSE-NOTICE.md` (mini, line 39 to 41) covers only the `omnivoice/` code as Apache 2.0 and
says nothing about the weights; the app's FAQ answer "Yes under VoiceStudio's AGPL-3.0 terms"
adds "model weights may use different licenses; review the selected engine's license before
commercial use." Every h- and s-line generated so far came out of CC-BY-NC weights, for a
commercial product's launch video. Chatterbox weights are MIT (https://huggingface.co/ResembleAI/chatterbox),
the mlx conversions Apache-2.0 (`chatterbox-fp16`) and MIT (`chatterbox-multilingual-v3`).
Inworld's free tier carries a commercial licence. This is the fact that reorders the ranking.

---

## 3. Hosted alternatives (read 2026-09-05)

All require an API key, which the user places in `.env`. ~1,500 characters for 15 lines.

| vendor | model for narration | key | free tier | cost for 1,500 chars | arena placement | instant clone |
|---|---|---|---|---|---|---|
| ElevenLabs | Multilingual v2 ("most stable on long-form"); Eleven v3 ("most emotionally rich", 5,000 char cap) https://elevenlabs.io/docs/overview/models | yes; free plan does not list API access | 10k credits/mo, **non-commercial only, attribution required** https://elevenlabs.io/pricing | $0.15 at $0.10/1k (v2, v3); $0.075 Flash. Starter $6/mo for 30k credits https://elevenlabs.io/pricing/api | TTS Arena: Turbo v2.5 #17 (1505), Multilingual v2 #20, v3 #27 (1498). AA: v3 Conversational #8 (1210), v3 #14, Multilingual v2 #34 | Starter and up; "1 to 2 minutes" recommended, works from ~30 s |
| OpenAI | gpt-4o-mini-tts (snapshot 2025-12-15, "more natural sounding voices"); no newer pure-TTS model https://developers.openai.com/api/docs/guides/text-to-speech | yes | none | about $0.01 (audio out $12/1M tokens); tts-1-hd $0.045 | gpt-4o-mini-tts absent from both arenas; TTS-1 HD #31 on AA (1106) | none; policy requires disclosing AI voice |
| Cartesia | Sonic 3.6, "fastest, most natural" https://docs.cartesia.ai/build-with-cartesia/models/tts | yes | 20k credits/mo, **no commercial licence, no cloning** https://cartesia.ai/pricing | Pro $5/mo (100k credits); pro-rata about $0.075 | **AA #1 (1282)**; TTS Arena has only Sonic 2 at #26 | Pro and up; "as little as 10 seconds", up to 60 s |
| Inworld | Realtime TTS-2 ("flagship, top-ranked") https://docs.inworld.ai/docs/tts/tts | yes (portal) | On-Demand $0, "up to 70 min TTS included", **commercial licence on all tiers** https://inworld.ai/pricing | $0.0375 at $25/1M; inside the free allowance | TTS Arena: TTS MAX #3 (1557), TTS #6 (1539). AA: Realtime TTS-2 #2 (1252), Flash #6 | all users; 3 s minimum, up to 30 s https://docs.inworld.ai/docs/tts/voice-cloning |
| Hume | Octave 2 (preview) https://dev.hume.ai/docs/text-to-speech-tts/overview | yes | 10k chars/mo; commercial licence listed only from Starter $3/mo https://www.hume.ai/pricing | $0.15 pro-rata Starter | TTS Arena #8 (1523); AA Octave 2 #57 | "as little as 15 seconds" |
| PlayHT / PlayAI | not available: play.ht and play.ai fail DNS today; docs.play.ai serves an expired cert. Meta acquired PlayAI July 2025, platform sunset 2025-12-31 (competitor migration pages, not Meta: https://inworld.ai/resources/migrate-from-playht) | | | | | |

Leaderboard top 10, HF TTS Arena V2 (41 rows, JSON, no timestamp field): Aurora (stealth) 1578,
CastleFlow v1.0 1558, Inworld TTS MAX 1557, Papla P1 1547, Deepdub eTTS 3.2 1557 (343 votes),
Inworld TTS 1539, star-june-2026 1544, Hume Octave 1523, Lightning v3.1 Pro 1536, MiniMax
Speech 2.8 HD 1528. Artificial Analysis top 10 (97 models): Cartesia Sonic 3.6 1282, Inworld
Realtime TTS-2 1252, Qwen-Audio-3.0-TTS-Plus 1241, Speechify Simba 3.2 1240, VUI Luna 1228,
Inworld TTS-2 Flash 1222, Breeze TTS 2 (open) 1215, ElevenLabs v3 Conversational 1210, Gemini
3.1 Flash TTS 1208, StepAudio 2.5 TTS 1205.

The two boards disagree (Cartesia #1 on AA, its older Sonic 2 #26 on HF; Hume #8 on HF, #57 on
AA). Inworld is the only vendor in the top 10 of both, and the only one whose free tier is
commercial. If a hosted fallback is used, that is the one to try; it still needs a key.

---

## 4. The no-narration option

From `/Users/kamal/Desktop/neobank/marketing/motion-spec.md` section 6 (whisper base on both
references; `volumedetect`, `silencedetect`, `astats`): DashX is music only, whisper transcript
empty, no silence gap, full mix -11.9 dB mean / 0.0 dB max, voice band 300 to 3400 Hz -18.1 dB.
Zaro is narration plus music with 29.6 s of speech in 43% of runtime. Neither cuts on the
beat. The spec's own instruction: "If there is no narration, do what DashX does: music only,
and let text tracking-in and the single colour flood carry the emphasis instead."

What a music-only cut needs, from the spec's measured splits:

- **On-screen copy carries the argument.** DashX by time: UI-COMPONENT 44%, TYPE 22%. The Sealed
  budget in the spec already assigns TYPE+CURSOR 8 s and TYPE-ONLY 5 s of 40 s; with no voice,
  every headline beat (75 frames, 2.5 s each, typed at 11 to 12 cps) must be a complete
  sentence a viewer can read in 2.5 s, roughly 6 to 8 words, and the number that must land uses
  the DashX tracking-in (1.3 s ease-out). The 15 hero lines in `hero.txt` are 4 to 15 words;
  h06, h10, h12, h13, h14 (12 to 15 words) would need cutting or splitting into two beats.
- **Music choice.** DashX bed: sparse onsets (30 in 30 s), one 1.55 s colour-flood hold, 105 BPM
  best-fit but no beat lock. The brief's current track `assets/music/sotto-v2-drive.mp3` is
  "Cipher2" by Kevin MacLeod, CC BY 4.0, 231 s, 44.1 kHz stereo, mean -18.7 dB, peak -0.1 dB,
  and `assets/music/ATTRIBUTION.txt` requires an on-screen or description credit. The render
  tool sets music to 0.35 when there is no narration and 0.16 under voice (`src/lib/assets.js`
  line 149 to 152).
- **Tooling gap.** `launch-video render --voice silent` strips voiceover **and** music
  (`src/lib/render.js` line 108 to 112), so it produces the -91 dB silent cut, not a music-only
  cut. Music-only means removing every `voice:` key from `briefs/sealed.yaml` scenes and
  rendering with the default mode; `assets.js` then treats the cut as non-narrated. That is a
  brief edit, not a code change.
- **The one silence.** The spec asks for a deliberate 0.4 s silence before the logo reveal; with
  no voice it has to be cut into the music bed itself.

This is a real option, and it removes the "AI voice" objection entirely, but it also removes
the mechanism the spec found in the narrated reference: 7 of 12 Zaro cuts sit within 0.5 s of
a spoken phrase onset. A music-only Sealed cut leans wholly on typography and the colour flood.

---

## Ranking

1. **Human-reference clone on Chatterbox via mlx-audio (mini).** Needs from the user: nothing.
   Needs from us: the 10 s public-domain Elizabeth Klett cut plus its typed transcript, and a
   3.1 GB one-time model download (`mlx-community/chatterbox-fp16` Apache-2.0 plus
   `S3TokenizerV2`). No pip install, no key, MIT-licensed weights, `exaggeration` knob. Evidence
   that it beats OmniVoice on naturalness is thin (TTS Arena #28; vendor-funded Podonos test
   whose mean leans to ElevenLabs), so the prosody check decides, not the leaderboard.
2. **Same human reference through OmniVoice, as a diagnostic only.** Zero download, one
   command, tells us in a minute whether the reference or the engine was the problem:

   ```bash
   ssh mini-ts 'cd ~/VoiceStudio && .venv/bin/omnivoice-infer \
     --ref_audio ~/vo-fix/human/ref-human.wav --ref_text "<exact transcript>" \
     --text "Salary. Rent. Last night." --language en \
     --num_step 32 --class_temperature 0.3 --postprocess_output false \
     --output ~/vo-fix/human/h02-omni.wav'
   ```

   Not shippable for a commercial video: weights are CC-BY-NC per the model's README.
3. **Inworld TTS-2 hosted.** Needs: an API key in `.env`. Free tier is commercial and covers
   the job; top 10 on both arenas; clones from 3 to 30 s. Cartesia Sonic 3.6 ranks higher on
   one board but its free tier is non-commercial with no cloning; ElevenLabs' free tier is
   non-commercial with attribution and no API access; OpenAI has no cloning and no free tier.
4. **Music only.** Needs: brief edit removing `voice:` keys, headline copy cut to 6 to 8 words
   per beat, on-screen credit for the Kevin MacLeod track. Removes the objection by removing
   the voice, and removes the narration-onset cutting rhythm the spec measured in Zaro.

Whatever path wins, the s-series and h-series wavs already in `assets/voice/` and
`remotion/public/voice/` were made with CC-BY-NC weights and should not ship.

Blind spots of this document: no human recording was measured as a same-engine control; the
arena numbers were read via their JSON and pages, not by voting; Hume's free-tier commercial
status is inferred from the Starter tier listing a licence the free tier does not; the OpenAI
cost is derived from token prices, not a vendor quote.
