# Art provenance — Emberfall Chronicles v3

The current game uses original generated Chibi fantasy / painted-pixel sprite art. No MU Online or Seraph Fall artwork, maps, sprites, UI files, logos, music or code was imported. References guided the general mood and genre. There are no third-party downloaded NPC or monster packs requiring attribution in this build.

Six RGBA PNG atlases were generated using the platform image_gen tool and imported into assets/production/. Environment separation/repacking was performed through image_gen. tools/inspect-atlas.py reads alpha bounds and produces crop metadata; it does not repaint images. Runtime Canvas rendering samples/composites these atlases. Detailed pixels and painted shading are generated art, not a claim that every pixel was placed manually.

- sword.png / archer.png / mage.png: 6×5 frames per class, idle/run/attack/cast/death.
- back.png: rear movement and attack/cast rows for the three classes; row boundaries are recorded in src/art.js.
- monsters.png: 12 archetypes in idle/active poses plus six elite masters. Ghost reuses the lich appearance. Reaction, breathing, travel bob, strike, fading and death transforms are composed in the renderer.
- environment.png: 12 separated buildings, trees, fountain, arch, crystal and volcanic props. Source rectangles and SHA256 inspection are in QA/art-inspection.json.
- Terrain, shore foam, paths, benches, lamps, atmospheric particles, skill VFX and SVG icons are implemented in the game source. Optional sound/music uses WebAudio synthesis.

NPCs share the class sprite wardrobe with independent names and services. Equipping items changes stats and aura; it does not load a separately drawn clothing set for every item.

No asset purchases or Meshy/Tripo credits were used. Image generation is a platform capability; this is not a statement that no ChatGPT credits or usage were consumed.

Runtime: native Canvas2D, DOM, LocalStorage, WebAudio, Service Worker; no CDN dependency. esbuild and Playwright are development tools (MIT / Apache-2.0 respectively); they are not included as runtime libraries. Pillow is used for inspection and ffmpeg for recording conversion. Original v1 assets/scripts and its immutable archive are retained separately and do not describe the current art pipeline.

Town revision v3 reuses the exact six atlases. No additional generation/provider call was made for this town revision. Signs, hedges, station placements and wider streets are runtime-authored changes.
