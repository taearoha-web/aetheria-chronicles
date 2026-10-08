# Aetheria Chronicles

A playable 3D fantasy party RPG foundation built for mobile browsers. Thai controls, a four-hero party, real-time combat, direct hero recruitment with gems, equipment-only summons, progression and local saves.

## Playable loop

Sanctuary → choose a story chapter → automatic basic attacks / manual or automatic skills → defeat three waves → receive equipment and currency → recruit story companions → improve the party → save and continue.

- Start with **Kael** and **Lyra**.
- Clearing chapters 1 and 2 recruits **Seraphina** and **Riven**.
- Five chapters, each with three waves and a boss encounter.
- Three active skills and one passive per hero; pause and 2× speed.
- Four more hero definitions can be bought directly for 1,200 gems each.
- Equipment summons: 160 gems once, 1,440 for ten. A ten-pull guarantees at least one rare item; a legendary is guaranteed within 50 pulls. Base rarity rates: common 50%, rare 35%, epic 12%, legendary 3%.
- Level training, equipment assignment and transfer, inventory, save export/import.
- No purchases with real money, accounts or multiplayer services.

These prices and balance values are initial editable defaults, not final owner-approved balance.

## Run locally or in a cloud workspace

Use Node 22 or newer:

```sh
npm ci
npm run dev -- --host 0.0.0.0
```

```sh
npm run check
npm run build
```

Serve `dist/` with an HTTPS static host. Do not open `index.html` using a `file://` URL; browser module/asset loading requires an HTTP server.

## iPhone and iPad

Open the deployed HTTPS URL in Safari. Landscape shows the battle scene most clearly; portrait also has a responsive layout. Use Safari's Share → Add to Home Screen if desired. Browser saves remain on that device and origin; export a backup before clearing Safari data or moving to another device.

The first load needs a network connection. This version does **not** promise fully offline caching or cross-device cloud saves. Landscape and portrait browser emulation is tested; physical iOS device performance still needs owner testing.

## GitHub and cloud continuation

The included workflows run tests/builds and retain a downloadable web build. The Pages workflow is manual: enable GitHub Pages with **GitHub Actions** as the source, then run **Publish playable game**. GitHub account/repository eligibility must support Pages; do not change repository visibility merely to work around an access problem.

For development while the computer is asleep, the repository must be connected to a **published Codex Cloud environment**. Merely storing code on GitHub does not make this local chat a cloud task. Follow [CLOUD-SETUP.md](docs/CLOUD-SETUP.md).

## Models and current scope

The runtime uses **16 distinct, rigged, textured user-provided GLB models**: eight individual heroes, three normal enemy species and five bosses. Heroes never share model keys or GLB payloads. Character selection shows matching model portraits. Models load on demand with two concurrent downloads; combat waits for its actors to finish loading.

The eight heroes include a knight, mermaid spirit, phoenix, abyss warrior, crystal titan, lightning wolf, monkey king and radiant lion. The owner approved playable beasts and spirits. Existing hero IDs, purchases and saves are preserved. See [ART-DIRECTION.md](docs/ART-DIRECTION.md) and [ATTRIBUTION.md](public/assets/ATTRIBUTION.md).

Play privately at [Aetheria Chronicles](https://aetheria-chronicles.taemongkichi.chatgpt.site), signed in with the owner's ChatGPT account. The Site uses project ID appgprj_6ac77409fc0c8191be01432cf67726ae; reuse that Site when publishing updates.

## Project map

| Location | Purpose |
| --- | --- |
| `src/simulation` | Combat, hero/equipment data, progression and persistence |
| `src/render` | Scene, cameras, models, animation and effects |
| `src/main.ts`, `src/style.css` | Mobile user interface |
| `public/assets` | Self-contained GLBs, portraits, license manifest and structural report |
| `tests` | Rule tests and actual-browser flow checks |
| `.github/workflows` | Cloud build/testing and manual deployment |

All local source code rights remain with the project owner. The individual 3D asset terms are documented separately; this repository does not relicense user-owned model files as CC0.
