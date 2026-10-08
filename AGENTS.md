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

## Current art limitations
See `docs/ART-DIRECTION.md`. The first delivery reuses three owner-authored fantasy models and two CC0 models. Two women are mermaid spirits and the rogue is unarmed. Shop heroes currently reuse four model archetypes. Replace these with dedicated human anime fantasy heroes in a subsequent approved art pass; do not describe this set as final King's Raid-quality art.
