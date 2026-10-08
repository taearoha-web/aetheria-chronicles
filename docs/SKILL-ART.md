# Signature spell presentation

The 24 hero skills use a separate Three.js presentation timeline. Rendering never spends energy or applies damage. Combat events carry exact skill identity and recipients so healing visuals appear on allies, executes on the weakest enemy, and area attacks on all affected enemies.

- Kael: cyan blade crescents, a protective barrier, broad Horizon Break.
- Lyra: starlight pillars, rising petals, Astral Bloom barriers.
- Seraphina: fire projectiles, inferno plumes, a winged flame dive for Phoenix Fall.
- Riven: violet crossed blades and an Eclipse halo.
- Astrid: erupting crystal shards and a faceted Icewall.
- Elias: jagged lightning, chained arcs, overhead Tempest bolts.
- Nova: green staff trails and spiralling wind ribbons.
- Lucien: golden judgement pillars and restorative light.

Each cast has a short charge, release, impact and dissipation. Numbers and secondary hit feedback release after 0.24 seconds of presentation time; the simulation retains its existing immediate damage rules. Timelines follow battle speed and freeze on pause. Ultimate cues show a compact name ribbon and a restrained camera impulse.

Shared procedural glow/sigil textures, one GPU particle draw per recipient, at most eight active casts, and explicit geometry/material cleanup bound the effect workload. Light mode halves particles, reduces decorative geometry and removes camera shake/zoom. System reduced-motion preference enables it by default. There are no new remote effect assets or paid services.

Spell sounds are original Web Audio synthesis with elemental noise, charge sweeps, transient impacts and support chimes. Sound remains off until enabled in Settings. A compressor limits stacked sounds; pause, mute, page changes and backgrounding stop active or scheduled voices.

These are a stylized browser VFX upgrade. Production-quality hero choreography would require dedicated authored skill animations, hand-painted effect atlases and per-skill sound design. No King's Raid assets are imported.
