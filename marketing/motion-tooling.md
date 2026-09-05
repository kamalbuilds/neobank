# Motion tooling for a Zaro-grade launch video, rendered programmatically

Researched 2026-09-05. Target project: `/Users/kamal/.agents/tools/launch-video/remotion`
(`remotion` 4.0.518 installed, React 19.2.8, `@remotion/transitions` and `@remotion/motion-blur`
already present, `Config.setConcurrency(4)`, jpeg frames). Latest Remotion on npm is 4.0.520
(published 2026-09-01). Every `@remotion/*` package must share one exact version, so the pins
below use 4.0.518 to match the installed core; all of them exist at that version (checked with
`npm view <pkg>@4.0.518 version`). Running `npx remotion upgrade` moves everything to 4.0.520
at once if preferred.

## What the reference actually does (from /tmp/zaro-sheet.jpg)

- Rebuilt product UI, not screen recordings: a "Deal Tracker" app with sidebar, pipeline table,
  chat thread, agent list, each element entering with stagger.
- Cursor as an actor: travels, clicks "Open full app", hovers a folder in the file grid.
- Detail zooms: bar chart and donut chart pulled out of the dashboard into their own frame.
- Icon constellation: Slack, Notion, Google Drive, HubSpot, Figma marks scattered on a cream
  field around "Connect your tools", drifting toward a stacked "Connections" card.
- Dot-matrix particle field: a halftone grid of dots forming a soft ring (the "thinking" beat).
- Card / device tilt: phone frames and a final "You didn't just build an app" tablet with
  perspective tilt and a warm brown / cream palette.
- Typed headlines with a caret ("Build an app. With |", "Con|"), one line per beat.

None of this needs a 3D engine. It is DOM plus SVG plus CSS `perspective`, choreographed with
staggered timelines. The gap in the current attempt is choreography density, not renderer.

## Tool table

| Tool | What it does | Headless render (macOS/Linux) | Install, pinned, with source | Licence | Verdict |
|---|---|---|---|---|---|
| **motion.so (Mosaic Motion)** | Hosted "text to launch video" agent. REST API `POST /sessions` with prompt, `aspect_ratio`, `duration` bucket, `design_md`, attachments; poll `GET /sessions/{id}` for `output.download_url` (MP4). MCP server at `https://mcp.motion.so/mcp` with OAuth 2.1 and self-registering service accounts. | Yes, it renders on their cloud; nothing runs locally. No spec-to-mp4 control: you send a prompt, the agent designs the video. | No install. API key from Settings → API, or MCP connector. Source: https://docs.motion.so/llms.txt and https://docs.motion.so/reference/sessions | Proprietary SaaS. Credits sold at $5 per 200; 200 credits is roughly 1 to 2 videos (https://docs.motion.so/guides/credits). `design_system_id` / custom `design_md` need a Pro or Max account (https://docs.motion.so/reference/sessions). No free tier found on motion.so; `/pricing` returns 404, plans are shown in-app. | Usable today from a script, but it is a black box: you get their taste, not a deterministic composition of our real product screens. Worth one paid test as a reference cut, not as the pipeline. |
| **@remotion/gsap** (new, official) | `useGsapTimeline()` builds a paused GSAP timeline and seeks it to `frame / fps`. Full GSAP API: labels, position params, staggers, keyframes, repeats, yoyo, nested timelines, SVG attrs. Adopted from `remotion-gsap` in PR remotion-dev/remotion#10738, merged 2026-08-24; 8 renderer parity tests pixel-compare serial vs concurrent vs shuffled renders. | Yes, plain DOM. | `npm i --save-exact @remotion/gsap@4.0.518` then `npm i --save-exact gsap@3.15.0` (peer `gsap >=3.12.0 <4`). Source: https://www.remotion.dev/docs/gsap | `@remotion/gsap`: MIT. `gsap` 3.15.0: "Standard no-charge licence", all plugins (SplitText, MorphSVG, Flip, DrawSVG, MotionPath) free since 3.13 under Webflow (https://gsap.com/blog/3-13). | **The single biggest upgrade.** Zaro's staggered screen builds, wipes, odometers and card choreography are exactly what a GSAP timeline expresses in ten lines. |
| **@remotion/three** + React Three Fiber | `<ThreeCanvas>` makes `useCurrentFrame()` work inside R3F; `<ThreeWebGPUCanvas>` for TSL materials; `useVideoTexture()` / `useOffthreadVideoTexture()` to map a video onto a mesh. Official template `remotion-dev/template-three` (108 stars, MIT, pushed 2026-09-01) ships a 3D phone with a video screen. | Yes. Docs: set `Config.setChromiumOpenGlRenderer("angle")` on desktop, `swangle` with no GPU (slow), `angle-egl` on Linux GPU. Known memory leaks with `angle` on long renders; split renders. | `npm i --save-exact three@0.185.1 @react-three/fiber@9.7.0 @remotion/three@4.0.518 @types/three` Source: https://www.remotion.dev/docs/three (`npm i three @react-three/fiber @remotion/three @types/three`). R3F 9.7.0 needs React `>=19 <19.3`: project has 19.2.8. | `@remotion/three` MIT; `three` MIT; `@react-three/fiber` MIT. | Only needed if the card must be a true 3D object with lighting and reflections. Zaro's tilts are CSS `perspective` + `rotateX/Y`, which the project already can do. Optional, second wave. |
| **@remotion/lottie** + lottie-web | `<Lottie>` seeks a Lottie JSON with `goToAndStop()`. Supports speed, direction, remote files, `getLottieMetadata()`. Expressions may render non-deterministically (documented limitation). | Yes. | `npm i --save-exact @remotion/lottie@4.0.518 lottie-web@5.13.0` Source: https://www.remotion.dev/docs/lottie (`npm i @remotion/lottie lottie-web`). | `@remotion/lottie`: Remotion License (free for individuals and companies up to 3 people, https://github.com/remotion-dev/remotion/blob/main/LICENSE.md). `lottie-web` 5.13.0 MIT. | Use for the few "canned" glyphs (lock closing, card tap, checkmark). Do not build the video out of stock Lotties; that is the slide-deck look again. |
| **@remotion/noise** | `noise2D/3D/4D()` simplex noise, seeded, pure function of inputs. | Yes. | `npm i --save-exact @remotion/noise@4.0.518` Source: https://www.remotion.dev/docs/noise | MIT | Drives the dot-matrix field: dot radius or opacity = noise3D(x, y, frame). Take it. |
| **@remotion/paths** | SVG path utilities: `evolvePath()` (draw-on), `interpolatePath()` (morph), `getPointAtLength()`, `getTangentAtLength()`, `warpPath()`, bounding boxes. No dependencies. | Yes. | `npm i --save-exact @remotion/paths@4.0.518` Source: https://www.remotion.dev/docs/paths | MIT | Draw-on for the donut chart, connector lines between icons, and moving the cursor along a curve with `getPointAtLength()`. Take it. |
| **@remotion/shapes** | `makeCircle/Rect/Pie/Star/Polygon…()` return SVG path strings plus React components. | Yes. | `npm i --save-exact @remotion/shapes@4.0.518` Source: https://www.remotion.dev/docs/shapes | MIT | `makePie()` is the animated donut chart; `makeRect()` with radius for card masks. Cheap, take it. |
| **@remotion/animation-utils** | `makeTransform()` (typed transform string builder) and `interpolateStyles()` (interpolate whole style objects). | Yes. | `npm i --save-exact @remotion/animation-utils@4.0.518` Source: https://www.remotion.dev/docs/animation-utils | MIT | Convenience only; useful for the perspective tilt so `perspective/rotateX/rotateY/translateZ` stays readable. Optional. |
| **@remotion/motion-blur** (installed) | `<Trail>` and `<CameraMotionBlur>` higher-order components that re-render children at sub-frame offsets. | Yes. | Already at `^4.0.518`; remove the caret. Source: https://www.remotion.dev/docs/motion-blur | MIT | Wrap the fast card slides and wipes; adds the "shot on a camera" feel Zaro has. Keep. |
| **@remotion/transitions** (installed) | `<TransitionSeries>` with `fade, slide, wipe, flip, clockWipe, iris, pushCut` and canvas presentations `zoomBlur, dreamyZoom, filmBurn, linearBlur, bookFlip, zoomInOut, dissolve`. | Yes. | Already at `^4.0.518`; remove the caret. Source: https://www.remotion.dev/docs/transitions | Remotion License (npm `license` field literally reads `UNLICENSED`; terms are the monorepo LICENSE.md). | Keep, but stop using it as the only motion. Zaro cuts are mostly hard cuts and in-scene wipes, not cross-scene transitions. |
| **@remotion/skia** | React Native Skia (CanvasKit WASM) inside Remotion via `enableSkia()` bundler override and `LoadSkia()` before `registerRoot`. Shaders, blur, masks, paths. Template `remotion-dev/template-skia` (24 stars). | Yes. | `npm i --save-exact @remotion/skia@4.0.518 @shopify/react-native-skia` Source: https://www.remotion.dev/docs/skia | MIT (peer `@shopify/react-native-skia` MIT) | Heavier setup for effects CSS already covers here. Skip unless a shader is truly needed. |
| **@remotion/rive** | `<RemotionRiveCanvas>` renders a `.riv` at the Remotion frame. | Yes. | `npm i --save-exact @remotion/rive@4.0.518` Source: https://www.remotion.dev/docs/rive | Remotion License | Only useful if a `.riv` exists. See Rive row. |
| **Rive** (`@rive-app/react-canvas` 4.34.1, `@rive-app/canvas` 2.42.0, `@rive-app/webgl2` 2.42.0) | Open-source runtimes for editor-authored `.riv` files. `.riv` is a binary produced by the Rive editor; exporting for runtime is a paid feature (Cadet plan, $9/seat/mo, https://rive.app/pricing). There is no public library or CLI that writes `.riv` from code; the `FileFormat` scripting protocol is for importing custom formats into the editor, not writing `.riv`. Programmatic authoring exists only as the **Rive MCP server** (`http://127.0.0.1:9791/mcp`) that drives the open desktop editor: create shapes, keyframes, state machines from an agent (`claude mcp add --transport http rive http://127.0.0.1:9791/mcp`, https://rive.app/docs/editor/ai/mcp). | Runtime: yes inside Remotion via `@remotion/rive`. Authoring: needs the desktop editor running (macOS app), then a paid export. | `npm i --save-exact @rive-app/react-canvas@4.34.1` Source: https://github.com/rive-app/rive-react (npm `repository.url`) | Runtimes MIT (rive-app/rive-wasm, rive-app/rive-react, rive-app/rive-runtime all MIT on GitHub). Editor proprietary, export paywalled. | Not a fit. A human-free pipeline would be: agent drives editor over MCP, human-free but not headless, then a paid `.riv` export. Everything Zaro shows is cheaper to do directly in React + GSAP. |
| **Theatre.js** (`@theatre/core` 0.7.2, `@theatre/studio` 0.7.2, `@theatre/r3f` 0.7.2) | Keyframe sequencer with a browser UI; `sheet.sequence.position = seconds` sets the playhead synchronously, so it is frame-deterministic inside Remotion. State is a JSON blob you can write by hand. | Yes for `@theatre/core` (no DOM of its own). | `npm i --save-exact @theatre/core@0.7.2` Source: https://github.com/theatre-js/theatre (npm `repository.url`) | `@theatre/core` Apache-2.0; `@theatre/studio` AGPL-3.0-only; `@theatre/r3f` Apache-2.0. | **Stale.** Last npm publish 2024-05-19, last commit 2024-04-11, 141 open issues, `@theatre/r3f` pins R3F `^8.13.6` (we would be on 9.x). GSAP timelines give the same sequencing with an active maintainer. Skip. |
| **Spline** (`@splinetool/react-spline` 4.1.0, `@splinetool/runtime` 2.0.37) | Editor-authored 3D scenes exported as `.splinecode` and played by a proprietary runtime that ticks on its own rAF loop (not seekable from `useCurrentFrame()`). The R3F code export path (`@splinetool/r3f-spline`) is deterministic but that package is at 1.0.2, last published 2023-03-10, and Remotion's own Spline tutorial carries an "out of date" banner (https://www.remotion.dev/docs/spline). | Runtime uses WebGL; would need `angle`. Not frame-deterministic anyway. | `npm install @splinetool/react-spline @splinetool/runtime` Source: https://github.com/splinetool/react-spline README. Pins: `@splinetool/react-spline@4.1.0 @splinetool/runtime@2.0.37` | `react-spline` MIT on GitHub; `@splinetool/runtime` has **no licence field on npm and no LICENSE file in the package** (checked unpkg), copyright Spline, Inc. Editor: Free / Hobby $12 / Pro $25 per seat per month (https://spline.design/pricing). | Skip. Editor-only authoring, non-deterministic runtime, unlicensed runtime package. |
| **Jitter** (jitter.video) | Hosted motion editor with Figma import, templates, "Superagents" AI, exports MP4 / GIF / **Lottie**. No API or CLI anywhere on the site (`/api` is 404). | No; browser editor only. | None. | Free plan: 3 files, 720p 30fps, Lottie export. Pro/Max unlock 1080p/4K, ProRes, transparent, frame-by-frame (https://jitter.video/pricing; prices rendered client-side). | Human-in-editor only. The Lottie export could feed `@remotion/lottie`, but that puts a person back in the loop. Skip. |
| **Fable** (fable.app) | Was the "Figma for motion". **Shut down November 2024** (School of Motion, Oct 21 2024: https://schoolofmotion.com/blog/motion-mondays-october-21-2024; https://amxmln.com/blog/2024/goodbye-fable/). `dig fable.app` returns only NS records at registrar-servers.com, no A record; the site does not resolve. | n/a | None. | n/a | Dead. Remove from consideration. |
| **Aninix** (aninix.com) | Figma plugin for Lottie-style UI animation; exports `.mp4 .gif .webm .lottie`. No API. 149k users claimed. | No; runs inside Figma. | None. | Personal $0 (2 projects), PRO $10/mo, Team $15/editor/mo (https://www.aninix.com/pricing). | Human-in-Figma only. Skip. |
| **motion / framer-motion** 13.2.0 | Declarative React animation, driven by `performance.now()` through its own frame loop. Remotion maintainers declined a bridge in remotion-dev/remotion#399 (JonnyBurger, 2023-12-05: hacking browser time "is not the way forward"); the third-party page still says no integration exists (https://www.remotion.dev/docs/third-party). Its `animate()` controls expose `.time`, `.pause()`, so a hand-rolled seek is possible, but nothing tested exists and layout animations / `AnimatePresence` run off wall-clock. | Renders, but frames differ between runs under concurrency. | `npm i --save-exact motion@13.2.0` Source: https://github.com/motiondivision/motion (npm `repository.url`) | MIT | **Do not use inside Remotion.** Studio preview looks right, `renderMedia()` with concurrency > 1 does not. Everything it offers, `spring()`/`interpolate()` or GSAP does deterministically. |
| **GSAP raw** (without the adapter) | Same library as above, but `timeline.play()` on GSAP's ticker. | Renders, breaks under concurrency (documented in remotion-dev/remotion#10598). | Covered by `@remotion/gsap` row. | Standard no-charge licence. | Always go through `useGsapTimeline()`; never call `play()`, never start the ticker. |
| **LottieFiles free library** | Search pages read in the `deepsurge` tab: 168 free "credit card", 735 free "payment", 477 free "lock" animations, downloadable as Lottie JSON / dotLottie (https://lottiefiles.com/free-animations/credit-card, /payment, /lock; Cloudflare blocks curl, browser needed). Public files are under the **Lottie Simple License FL 9.13.21**: free for commercial use, modification allowed, attribution encouraged not required (https://lottiefiles.com/page/license). `@lottiefiles/dotlottie-react` 0.19.16 MIT is their own player but is rAF-driven; use `@remotion/lottie` instead. | Yes via `@remotion/lottie`. | Download JSON into `public/`, load with `staticFile()`. | Lottie Simple License per file; check each file's badge is "Free", not "Premium". | Fine for two or three accent glyphs. Not a substitute for rebuilt product screens. |
| **remotion-bits** (av/remotion-bits, 459 stars, MIT, npm 0.2.0, pushed 2026-03-11) | Component library plus CLI/MCP catalogue: `npx remotion-bits find "3d cards"`, `particle-system`, `camera presentation` tagged `scene-3d`, `AnimatedText`, `GradientTransition`, charts. jsrepo registry at `https://unpkg.com/remotion-bits/registry.json`. | Yes, plain Remotion. | `npm i --save-exact remotion-bits@0.2.0` or `npx jsrepo add --registry https://unpkg.com/remotion-bits/registry.json particle-system` Source: https://github.com/av/remotion-bits README | MIT | Good quarry for a particle field and 3D card scene to read and adapt. Vendor the code (jsrepo) rather than importing the package. |
| **snapcn** (snapcndev/snapcn, 175 stars, MIT, pushed 2026-09-03) | shadcn-registry Remotion components built for software demos: `phone-frame`, `laptop-frame`, `terminal-simulator`, `answer-stream`, `search-typing`, `prompt-zoom`, `orbit-gallery`, `hero-launch`, `logo-assemble`, `text-reveal`, `word-flip`, `karaoke-captions`. Code lands in the repo; no runtime dependency. Needs `components.json` and `@/` alias in `remotion.config.ts`. | Yes. | `npx shadcn@latest add @snapcn/phone-frame` (and `@snapcn/answer-stream`, `@snapcn/search-typing`) Source: https://github.com/snapcndev/snapcn README | MIT | The closest existing match to Zaro's chat-stream and typed-prompt beats. Take `answer-stream`, `search-typing`, `phone-frame`. |
| **reactvideoeditor/remotion-templates** (229 stars, pushed 2026-04-21) | 81 copy-paste `.tsx` templates: `card-flip` (3D), `rotating-carousel`, `grid-pulse` (dot grid ripple), `particle-explosion`, `notification-pop`, `whip-pan`, `spotlight-reveal`, charts. | Yes. | Copy files. **No LICENSE file in the repo** (GitHub reports none, `/LICENSE` 404). | Unlicensed. | Read for technique, do not paste. |
| **Fats403/remotion-gsap-examples** (pushed 2026-08-20) | Runnable examples for the GSAP adapter including `ProductLaunch.tsx`: an 18-second launch film with skewed full-frame wipes, nested wrappers for section moves plus idle float, colorway swaps behind wipes, masked-column price odometer. | Yes. | Clone https://github.com/Fats403/remotion-gsap-examples and read `src/ProductLaunch.tsx`. | No licence field on GitHub. | The best single reference for the choreography style we are missing. Study, re-implement. |
| **Other repos found** | `Liamrjohnston/remotion-motion-graphics-skill` 57 stars MIT (agent skill, `npx skills add liamrjohnston/remotion-motion-graphics-skill`, bans neon/glow, demands real product UI); `zz41354899/SwiftClip` 43 stars MIT (32 Apple-light templates incl. Product Launch, SaaS Promo, Dynamic Island); `stefanwittwer/remotion-animated` 224 stars MIT (declarative `<Animated>`); `itsjwill/vanta` 108 stars (AI video engine, mostly TTS/avatars, off-target); `remotion-dev/trailer` 1125 stars (Remotion's own promo source). GitHub searches for "remotion launch video", "remotion product demo", "remotion device mockup", "remotion 3d card" return only 0-star personal repos. | | | | No turnkey "SaaS launch video" template exists at Zaro fidelity. The parts do. |

Licence note on Remotion itself: `remotion`, `@remotion/cli`, `@remotion/renderer`, `@remotion/lottie`,
`@remotion/rive`, `@remotion/transitions`, `@remotion/effects` are under the Remotion License
(free for individuals, companies up to 3 employees, and non-profits; Company License otherwise,
Creators seat $25/mo, https://www.remotion.pro/license). `@remotion/gsap`, `three`, `noise`,
`paths`, `shapes`, `motion-blur`, `animation-utils`, `skia`, `layout-utils`, `fonts` are MIT.

## Recommended stack

Minimal additions to `/Users/kamal/.agents/tools/launch-video/remotion` that close the gap to the
reference. Everything is DOM/SVG and a pure function of `useCurrentFrame()`, so the existing
`remotion render` on the Mac stays the pipeline; no GPU flags needed unless the optional 3D
layer is added.

1. **`@remotion/gsap@4.0.518` + `gsap@3.15.0`**: the choreography engine. One
   `useGsapTimeline()` per scene: sidebar rows stagger in (`stagger: 0.04`), table rows follow
   with a label, chat bubbles pop with `back.out`, cursor tween uses `motionPath` (now free),
   skewed wipe covers the frame while `.set()` swaps the scene state. Source
   https://www.remotion.dev/docs/gsap.
2. **`@remotion/noise@4.0.518`**: the dot-matrix field. A 96x54 grid of `<circle>`s whose radius
   is `interpolate(noise3D("dots", x*0.08, y*0.08, frame*0.02), [-1,1], [0.6, 2.4])`, masked by a
   ring path so it reads as the "thinking" halo in the sheet. Source
   https://www.remotion.dev/docs/noise.
3. **`@remotion/paths@4.0.518` + `@remotion/shapes@4.0.518`**: donut chart via `makePie()` and
   `evolvePath()`; bar chart via `makeRect()`; connector lines between icons in the constellation
   drawn on with `evolvePath()`; cursor path via `getPointAtLength()`. Sources
   https://www.remotion.dev/docs/paths, https://www.remotion.dev/docs/shapes.
4. **snapcn `answer-stream`, `search-typing`, `phone-frame`** vendored with
   `npx shadcn@latest add @snapcn/answer-stream` (MIT, code lands in repo). These are the typed
   prompt, streaming reply and phone beats. Source https://github.com/snapcndev/snapcn.
5. **Card tilt with CSS, not three.js**: `perspective(1400px) rotateX(8deg) rotateY(-12deg)`
   driven by GSAP on a wrapper, `@remotion/animation-utils@4.0.518` `makeTransform()` for
   readability, `<CameraMotionBlur>` (already installed) around the fast moves. This is what the
   sheet shows.
6. **Keep** `@remotion/transitions` for a few `wipe()`/`pushCut()` cuts and
   `@remotion/motion-blur` for trails. Remove the `^` from both in `package.json` so all
   `@remotion/*` stay at one exact version.
7. **Optional, second wave**: `@remotion/three@4.0.518 three@0.185.1 @react-three/fiber@9.7.0`
   only if the card must show real lighting; then add
   `Config.setChromiumOpenGlRenderer("angle")` to `remotion.config.ts`
   (https://www.remotion.dev/docs/gl-options).
8. **Two or three LottieFiles glyphs at most** (lock close, card tap) via
   `@remotion/lottie@4.0.518 lottie-web@5.13.0`, Lottie Simple License, checked per file as
   "Free".

Not recommended: motion/framer-motion inside Remotion (non-deterministic, maintainers declined),
raw GSAP `play()`, Theatre.js (unmaintained since 2024), Spline runtime (unlicensed, rAF-driven),
Rive (editor-only authoring, paid export), Jitter/Aninix (no API), Fable (shut down). motion.so is
the one hosted option with a real API and MCP, worth a single credited run as a taste reference,
not as the render path for our own product screens.

Install sequence, none of it run yet:

```
cd /Users/kamal/.agents/tools/launch-video/remotion
npm i --save-exact @remotion/gsap@4.0.518 @remotion/noise@4.0.518 @remotion/paths@4.0.518 @remotion/shapes@4.0.518 @remotion/animation-utils@4.0.518 gsap@3.15.0
npx shadcn@latest add @snapcn/answer-stream @snapcn/search-typing @snapcn/phone-frame
# optional
npm i --save-exact @remotion/lottie@4.0.518 lottie-web@5.13.0
npm i --save-exact @remotion/three@4.0.518 three@0.185.1 @react-three/fiber@9.7.0 @types/three
```

## Evidence trail

- npm metadata: `npm view <pkg> version license time.modified peerDependencies` on 2026-09-05.
- Remotion docs pages fetched via curl: /docs/three, /docs/lottie, /docs/rive, /docs/gsap,
  /docs/third-party, /docs/flickering, /docs/gl-options, /docs/noise, /docs/paths, /docs/shapes,
  /docs/animation-utils, /docs/skia, /docs/transitions, /docs/motion-blur, /docs/spline.
- GitHub: `gh api repos/...` for stars, licence, `pushed_at`; issues remotion-dev/remotion#399,
  #10598, PR #10738.
- motion.so: https://docs.motion.so/llms.txt, /guides/mcp, /guides/credits, /reference/sessions.
- Rive: https://rive.app/pricing, /docs/editor/exporting/exporting-for-runtime,
  /docs/editor/ai/mcp.md, /docs/scripting/api-reference/file-format/file-format.md.
- LottieFiles pages read in the `deepsurge` browser tab (Cloudflare blocks curl).
- Fable: `dig +short fable.app A @1.1.1.1` empty; shutdown reports linked above.
- Blind spot: no package was installed or rendered here, so "headless yes" for R3F and Skia rests
  on Remotion's docs and template CI, not on a local render of this project.
