# Signature spell presentation

The 24 hero skills use a separate Three.js presentation timeline. Rendering never spends energy or applies damage. Combat events carry exact skill identity and recipients so healing visuals appear on allies, executes on the weakest enemy, and area attacks on all affected enemies.

- Kael: a sword-socket ribbon following the actual blade, a frontal cleave, rising team wards, and an authored leap/slam judgment.
- Lyra: a staff prayer with healing motes, crystal barrier panels, and offensive light judgment beams.
- Seraphina: fire projectiles, inferno plumes, a winged flame dive for Phoenix Fall.
- Riven: violet crossed blades and an Eclipse halo.
- Astrid: erupting crystal shards and a faceted Icewall.
- Elias: jagged lightning, chained arcs, overhead Tempest bolts.
- Nova: green staff trails and spiralling wind ribbons.
- Lucien: golden judgement pillars and restorative light.

Each cast has anticipation, impact and recovery. The simulation queues damage/healing/shields for the authored impact time and emits a separate impact event; the renderer no longer adds a second arbitrary delay. The starter pair have individual per-slot timelines matching their Blender clips. Timelines follow battle speed and freeze on pause. Ultimate cues show a compact name ribbon and a restrained camera impulse.

Shared procedural glow/sigil textures, one GPU particle draw per recipient, at most eight active casts, and explicit geometry/material cleanup bound the effect workload. Light mode halves particles, reduces decorative geometry and removes camera shake/zoom. System reduced-motion preference enables it by default. There are no new remote effect assets or paid services.

Spell sounds are original Web Audio synthesis with elemental noise, charge sweeps, transient impacts and support chimes. Cast and impact sounds are triggered separately by the simulation so a pause or speed change cannot leave an early scheduled impact playing. Sound remains off until enabled in Settings. A compressor limits stacked sounds; pause, mute, page changes and backgrounding stop active or scheduled voices.

The starter pair now have dedicated Blender-authored motion/skill clips and a safe preview in the hero menu. The remaining roster retains its existing authored clips. Further art refinement can improve cloth deformation, facial animation, hand-painted effect atlases and recorded sound design. No King's Raid assets are imported, and this is not a claim of equivalent production quality.
