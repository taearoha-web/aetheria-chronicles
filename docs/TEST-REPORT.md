# First playable verification — 8 October 2026

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
