# Art provenance — Emberfall Chronicles v4

Original chibi fantasy / painted-pixel art. No MU Online or Seraph Fall assets, logos, maps, UI files, music or code were imported. References guided mood and genre. No third-party NPC packs are used.

New NPCs: assets/production/npcs.png contains six independently designed workers and six occupational poses per worker. Luna the elderly map reader, Bo the portly apothecary, Akra the dwarf smith, Aeren the healer, Serin the fox quartermaster and Orin the gate warden use no player atlas. A single whole-atlas image_gen generation was followed by one image_gen repack to restore gutters/headroom. Original generated sources are retained under /workspace/generated_images. Source SHA256 and all frames are in review/npc-v4/npc-art-inspection.json.

tools/inspect-npcs.py reads alpha gutters and produces src/npc-atlas.js. Runtime crops/anchors align feet with one shared scale per role; the PNG is copied unchanged. Stationary occupational animation and mirroring are provided, not individually painted eight-direction walking sets. Occupational gestures come from the six sprite poses; greeting bubbles and some sparks/glows are composed at runtime.

Existing sword/archer/mage PNGs each have30front frames (idle/run/attack/cast/death). back.png provides rear locomotion/attack masters with mirrored directions and runtime transforms. monsters.png provides12archetypes with idle/active masters and6elite masters; reactions, movement bob, death and hazards are composed in runtime. These are not full hand-drawn animation sets for every state/direction. environment.png has12separated props. All existing source PNGs are retained.

Wooden fences, hinges/gate opening, signs, benches, lamps, terrain, ambient particles, skill VFX and SVG icons are authored in runtime code. Equipment changes stats/aura; a separate costume sprite for every item is not provided. WebAudio synthesizes optional sound/music.

No asset purchases or Meshy/Tripo credits were used. New NPC art uses platform image_gen and is not a claim that no ChatGPT usage/credits were consumed, or that every pixel was manually placed.

Runtime uses nativeCanvas2D/DOM/LocalStorage/WebAudio/ServiceWorker without a CDN. esbuild(MIT) and Playwright(Apache2) are development tools; Pillow reads atlas bounds and ffmpeg encodes captures. No third-party engine is added. Prior immutable deliveries/receipts remain under review/v2 and review/town-v3.

## Original background music v5

Eleven original procedural compositions and local synthesis patches in src/music.js. No third-party music samples, soundfonts, provider jobs, or MU audio. See MUSIC.md for per-scene themes and verification.

## v6 skill art — 2026-10-15
Original generated VFX and character action sheets commissioned in this conversation from the user's approved Emberfall concept sheets and existing original character sprites. No external game sprites were downloaded. Six new production atlases: skills-{sword,archer,mage}.png (20 motifs each), poses-{sword,archer,mage}.png (4 action families × 6 frames each). Raw outputs retained in /workspace/generated_images; normalization recipes in tools/normalize-skill-{vfx,poses}.py and manifests in review/skills-v6. Runtime layers and procedural audio are original code. Concept posters are review references, not substituted for gameplay captures.
