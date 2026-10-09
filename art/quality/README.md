# Character quality review

These are editable review candidates, separate from the shipped v0.5 starter rigs.
`knight.blend` and `priestess.blend` contain packed textures, the complete mesh,
30 bones, and all ten actions. They open in Idle at frame 1. Blender 5.2.2 was used.
The original user source files and the main-game rigs remain unchanged.

The first pass lost visible facial shape and smooth shading during whole-body
decimation and reduced the source textures from 2048 to 1024. It was not an
isolated GLB export failure. These candidates preserve original head faces above
1.52 m, reduce only the remaining body to about 60,000 triangles, transfer the
original surface normals, and retain both original 2048 PBR texture maps.

| Candidate | Triangles | Runtime GLB bytes | Revised actions |
| --- | ---: | ---: | --- |
| Knight | 121,987 | 10,501,744 | Attack_01 and Skill_01 |
| Priestess | 121,638 | 9,841,404 | Skill_01 |

The knight actions now use different strike planes, loaded knees, a guarded
off-hand, and planted contact ankles. The priestess prayer brings her hand
toward her chest with a stable staff and planted feet. Other actions are retained
as a baseline; they have not received this motion-quality pass. There is no
individual finger or facial animation, and cloth follows the existing limited
bone rig. These are bounded improvements, not a production retopology or a
claim of King's Raid animation quality. The increased memory and download cost
still needs physical iPhone testing.

## Export without the original PC files

From the repository root, with Blender on PATH:

```sh
blender -b -t 2 --python scripts/characters/export_quality_rigs.py -- \
  --characters art/quality --output-dir public/assets/quality
```

This uses the packed editable rigs only, exports embedded textures and all clips,
and writes a hash receipt. It never saves over the .blend sources.

## Reproduce individual repair steps

Rebuilding the source-head replacement requires the owner's original GLB. Routine
editing or re-exporting the packed files above does not require it.

```sh
blender -b -t 2 --python scripts/characters/preserve_source_heads.py -- \
  --source /path/to/original-knight.glb --rig art/characters/starter-knight.blend \
  --output work/quality-reset/knight-repaired.blend --height 1.90

blender -b -t 2 --python scripts/characters/author_contact_poses.py -- \
  work/quality-reset/knight-repaired.blend \
  work/quality-reset/animation/knight-contact.blend --no-renders

blender -b -t 2 --python scripts/characters/author_priestess_cast.py -- \
  --input work/quality-reset/priestess-repaired.blend \
  --output work/quality-reset/priestess-cast.blend
```

For the priestess head repair, use her original GLB and packed baseline rig with
`--height 1.95`. Each script reads its input and writes a separate derivative.
The cast scripts record retained-action fingerprints and baked ankle drift.
Normal/weight transfer handles degenerate source faces using nearest valid rig
weights as a fallback; six knight vertices required that fallback in this pass.

Authored timing remains Attack_01 0.92 s / contact 0.42 s and Skill_01 1.15 s /
contact 0.48 s for the knight; priestess Skill_01 1.30 s / release 0.58 s. GLB
export includes approximately one frame of timeline padding, which the review
player maps to the authored durations.
