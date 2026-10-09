# Combat presentation review

Open `/quality-review.html` for the isolated combat study. This route is a
presentation prototype; it does not change campaign progress, inventory, hero
purchases, equipment draws, or the original game route.

## Why this exists

Close-up comparison with the user's untouched source meshes showed that the
80,000-triangle preparation pipeline damaged surface shading, especially on the
knight's face. Increasing texture resolution alone did not correct it. Transferring
surface normals from the original mesh visibly improved the cheek and armor.
The final review candidates also preserve the original head faces and restore
2048-pixel textures. Body detail remains simplified. Each candidate has about
122,000 triangles, a higher cost than the previous whole-body reduction.

The previous knight's basic attack and first skill shared an impact pose and
had visible foot movement. The review separates their strike poses and reduces
foot sliding at contact. The priestess's prayer also has a revised hand gesture
and planted feet. This is a bounded repair, not a completed animation set.

The review also changes the camera, character scale, contact staging, lighting,
environment, and skill presentation together so they can be evaluated in motion.

## Reference and limits

The user supplied King's Raid as a visual reference. Observations came from
visible combat frames in https://www.youtube.com/watch?v=brxDD5u8apU at
approximately 47–50 seconds: a compact front line in physical contact with
monsters, a rear caster, and a shallow side view. The other supplied video
https://www.youtube.com/watch?v=4IbM8Nxd6mc only played its opening successfully
in this session; combat at later requested seek times was not verified.

No video imagery, characters, audio, or game assets from King's Raid are included.
The two starter characters come from the user's supplied local GLBs. Existing
supporting game assets retain their original provenance records.

`public/assets/quality/ruins-background.png` is original environment artwork
generated with OpenAI Imagegen on 2026-10-09. It is a background matte. The
characters, skeletal animation, ground, shadows, and combat effects are rendered
in real time. The image is not evidence of the running game's appearance.

Image prompt: A wide landscape fantasy royal stone causeway at dawn, weathered
ivory Gothic ruins, moss and dark teal foliage, misty blue distant mountains,
warm upper-left sunlight; lower 45 percent a quiet dark blue-grey continuous
stone road for real 3D characters; elegant asymmetric architecture. No people,
characters, animals, weapons, magic, explosions, circular arena, UI, or lettering.

Packed editable rigs, portable Blender scripts, and their validation reports
are documented in [art/quality/README.md](quality/README.md). The packed knight
was re-exported without the original PC files and produced an identical GLB.

Desktop browser viewport checks are not a substitute for testing on an actual
iPhone or iPad. Animation, cloth deformation, silhouette detail, and mobile
performance need further review before this presentation is integrated into
the full campaign.

For browser checks, run the local preview and then
`node tests/e2e/combat-review.mjs`. `BROWSER_EXECUTABLE`, `REVIEW_URL`, and
`REVIEW_ARTIFACTS` can override browser path, URL, and screenshot output folder.
