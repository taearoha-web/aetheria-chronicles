# Active character asset provenance

All 16 active textured character models are supplied by the owner. Fourteen supporting heroes/enemies are from the existing Seven Elements project. The human starter knight and priestess are from the two model folders explicitly supplied on 2026-10-08 and were rigged/animated locally in Blender. These proprietary assets retain their original provider license and owner rights; they are not relicensed as CC0 or covered by the source-code license. No new paid asset generation was used.

| Runtime file | Owner project source |
| --- | --- |
| models/starter-knight.glb | model_20261008_195253/model_20261008_195253.glb |
| models/starter-priestess.glb | model_20261008_204527/model_20261008_204527.glb |
| seraphina.glb | assets/scroll_monsters_v3/fire_phoenix.glb |
| riven.glb | assets/web_monsters/abyss_king_web.glb |
| astrid.glb | assets/web_monsters/earth_titan_web.glb |
| elias.glb | assets/web_monsters/lightning_wolf_web.glb |
| nova.glb | assets/legendary_v3_r4/wind_monkey.glb |
| lucien.glb | assets/web_monsters/light_guardian_new.glb |
| tiger.glb | assets/scroll_monsters_v3/earth_tiger.glb |
| pegasus.glb | assets/scroll_monsters_v3/light_pegasus.glb |
| peacock.glb | assets/scroll_monsters_v3/wind_peacock.glb |
| boss-earth.glb | assets/paladins_v1_r6/earth_paladin.glb |
| boss-dark.glb | assets/paladins_v1_r6/dark_paladin.glb |
| boss-firelion.glb | assets/web_monsters/fire_lion_web.glb |
| boss-seadragon.glb | assets/legendary_v3_r4/sea_dragon.glb |
| boss-paladin.glb | assets/paladins_v1_r6/fire_paladin.glb |

Supporting creature derivatives were optimized in Blender to approximately 18,000 triangles and embedded JPEG textures capped at 512px, preserving their existing skeletons and animations. The starter pair receive custom rigs/weights, separate motion and skill clips, and additional face/texture detail. Their source hashes and rig receipts are retained with the character build scripts. Validation records final counts and SHA-256 hashes. Starter portraits are Blender renders of the shipped models; other portraits are renders or matching portraits reused from the owner project (Elias, Nova and Lucien). The original owner's files were not modified.

Legacy knight.glb (water_paladin), healer.glb (light_mermaid), mage.glb, rogue.glb and enemy.glb are no longer referenced by the runtime manifest. The legacy rogue and goblin files came from AutoSprite under CC0-1.0; their unused files retain that original provenance. No King's Raid extracted assets are used.
# Bundled fonts

The existing interface fonts are self-hosted in `assets/fonts/` so the game does not contact Google Fonts during play. Cormorant Garamond, Noto Sans Thai and Outfit are distributed under the SIL Open Font License 1.1; their unmodified license notices are included beside the WOFF2 files. Font files were obtained from the Google Fonts CSS service and `fonts.gstatic.com`; license sources are the official `google/fonts` repository under `ofl/cormorantgaramond`, `ofl/notosansthai`, and `ofl/outfit` (2026-10-08).

