# Starter heroes v0.5.0 — 8 October 2026

Final local checks passed on the locked knight and priestess exports:

- 41 gameplay/persistence tests (28 existing and 13 starter-specific tests).
- Strict TypeScript check and Vite production build.
- Asset validation: 16 embedded, textured, rigged models; eight unique hero models. Each starter has 80,000 triangles, 30 bones and ten distinct animation clips. Active model payloads total 32.28 MiB and load on demand.
- Opening each packed file in Blender 5.2.2 verified all ten actions, packed textures, 30 bones and Idle at frame 1. Exporting the packed files without the original PC GLBs reproduced the runtime models byte-for-byte.
- Final Edge touch emulation at 844×390 and 390×844: 20 animation selections through actual UI; six exact combat skills; authored impact/recovery timing; shared skeletal/VFX clock; paused bones and effects; paused camp return without duplicate casts; 1×/2× playback; preview leaves the saved profile unchanged; no JavaScript, shader, asset or network errors.
- Visually inspected both starter models, representative Run/Attack/Skill/Death poses, full-body portrait framing and landscape staging. Fonts are bundled locally with their OFL notices.

The final browser evidence is [starter-browser.json](validation/starter-browser.json). Editable-file evidence is [editable-blender-validation.json](../art/characters/editable-blender-validation.json). Reproduce the starter flow with `node tests/e2e/starter-heroes.mjs` after starting the development server. Set `QA_URL`, `QA_ARTIFACTS` and `EDGE_PATH` when needed.

These are local results, not a claim that GitHub Actions or physical iPhone/iPad testing passed. An initial final-browser attempt hit a navigation timeout while Blender and the production build were running; the completed retry ran on the same locked GLB hashes with a 90-second navigation timeout and unchanged gameplay assertions. No mobile hardware frame-rate claim is made. The source mesh still limits extreme cloth/finger deformation; facial animation, separate finger controls and physical cloth simulation are outside this rig.

## Earlier first-playable verification (historical)

## Automated rules and build

`npm run check` passed:

- Five GLB assets passed structural checks: embedded textures/buffers, rig, mapped animation clips, valid headers and paths.
- 24 gameplay/persistence tests passed.
- TypeScript strict checking and Vite production build passed.

Rule coverage includes real starter-team battles, story recruits, purchase cost and uniqueness, equipment-only gacha probabilities/pity/ten-pull guarantee, equipment transfer, validated save backups, rejected corrupt imports, single victory rewards, pause/speed and responsive manual skill interruption without duplicated costs or damage.

## Actual browser interaction

Two fresh Edge/Chromium touchscreen contexts passed full flows:

- Landscape: 844×390.
- Portrait: 390×844.

Both exercised boot with all real GLB downloads, direct hero purchase, equipment pull and equip, reload persistence, backup export/import and invalid-backup rejection, manual skill/cooldown, pause/resume, auto and 2×, three-wave boss victory, Seraphina recruitment, saved rewards, withdrawal and subsequent hero training.

No unhandled JavaScript exceptions or failed asset downloads were recorded. DOM width checks found no horizontal overflow. Screenshots were inspected for model appearance and HUD readability. A separate portrait camera check confirmed a three-hero party and enemies fit the view; rotating to landscape restored the closer camera.

## Practical limits

These are desktop browser runs using mobile dimensions and touch events, not a physical iPhone or a Safari/WebKit certification. Physical iPhone thermal performance, Safari memory behavior and touch feel need a device pass after HTTPS deployment. Frame rate from software-rendered automated browsers is not reported as mobile hardware performance.

The rule test suite and asset validator run automatically in GitHub Actions once the commit is uploaded. CI passing must be checked separately from the local results above.

## Reproduce

```sh
npm ci
npm run check
npm run dev -- --host 0.0.0.0 --port 4174
```

In a second terminal:

```sh
# On Linux/macOS, install Playwright Chromium once:
npx playwright install chromium
node tests/e2e/mobile-flow.mjs
```

On Windows the harness defaults to the installed Edge path. Override `EDGE_PATH`, `QA_URL` or `QA_ARTIFACTS` as needed. Browser artifacts default to `test-results/mobile`, which is ignored by Git.
