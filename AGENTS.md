# Aetheria Chronicles

## Owner's decisions
- Mobile 3D fantasy party RPG, inspired by the experience of King's Raid.
- Primary target: iPhone/iPad browser, landscape first, portrait usable.
- Begin with a male knight and a female healer. Story recruits fill a four-person party.
- Heroes are selected and bought directly with gems. Only equipment is randomized.
- All characters must use detailed textured 3D models with real skeletal animation. Never substitute boxes, circles, capsules, or flat portraits as playable actors.
- Original setting and lore. Do not import King's Raid extracted models, artwork, or music.
- User wants development to continue in a cloud environment while the PC is off. Keep all runtime assets and project instructions in this repository.

## Architecture
- `src/simulation/`: renderer-independent TypeScript game rules, persistence and data.
- `src/render/`: Three.js view of simulation state. No currency or battle rule mutations.
- `src/main.ts`, `src/style.css`: touch-friendly Thai/English DOM interface.
- `public/assets/manifest.json`: model URLs, sizes, facing direction and exact animation names.
- `public/assets/ATTRIBUTION.md`: asset provenance and licensing boundaries.

## Commands
- Install: `npm ci` (Node 22 or newer).
- Develop: `npm run dev -- --host 0.0.0.0`.
- Check: `npm run check`.
- Browser flow: see `tests/e2e/mobile-flow.mjs` and its comments; requires Playwright-supported browser.
- Publishable static files: `dist/` after build. Vite uses a relative base for GitHub project Pages.

## Quality requirements
- Inspect actual WebGL screenshots at 844×390 and 390×844 before claiming mobile visuals work.
- Report whether testing used a viewport emulator or a physical iPhone; they are not equivalent.
- Retain versioned save import/export; never silently reset or overwrite an invalid existing save.
- Victory rewards are applied once. Retries and reopening result screens must not duplicate them.
- Pause simulation while the page is backgrounded. Avoid duplicated animation/game loops.
- Preserve touch targets during combat; do not replace live button DOM every frame.
- Keep simulation tests meaningful, and run TypeScript + production build after code changes.
- Never claim GitHub upload, Pages deployment, or Codex Cloud setup succeeded without verifying the remote result.

## Current character roster
- The owner approved playable beasts and spirits, provided each hero has a distinct model.
- All eight heroes must have separate GLB files and model keys. Never reuse one hero model for another hero.
- There are 16 active user-provided models: eight heroes, three normal enemy species and five bosses.
- Load characters on demand, with at most two downloads at once. Suspend combat simulation while its models load; show a retry on failure instead of substituting a different actor.
- Preserve hero IDs, currency, purchases and saved progress when updating appearance.
- See docs/ART-DIRECTION.md for exact mappings and future work.

## Contact combat
- The owner requires melee heroes to approach and fight at monster contact, following the original King's Raid staging.
- Attack mode is explicit per hero. Nova uses a melee staff despite retaining the existing ranger role and saved ID.
- Keep movement, range checks, body spacing and hit timing in the simulation. Rendering reads positions, turns toward targets and plays authored Run clips.
- Never replace melee contact with a ranged energy trail. Healing and ranged heroes retain rear-line distance.
- Offensive melee skills submitted out of range reserve their cost once and approach before release. Pause must freeze movement and pending hits.
- See docs/CONTACT-COMBAT.md for inspected reference footage and implementation boundaries.
