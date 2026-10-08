# Character art direction and next art pass

## Desired direction

Detailed 3D anime-fantasy heroes: attractive expressive faces, coherent full-body proportions, carefully authored outfits, recognizable silhouettes and individual weapons. The reference is the experience of King's Raid, with an original cast and world. Core cast: male sword-and-shield knight, female healer, female fire mage, male agile attacker. The owner explicitly rejected primitive placeholder actors.

## What is actually supplied now

| Runtime archetype | Asset actually rendered | Current limits |
| --- | --- | --- |
| Knight | Owner's detailed silver/blue water paladin | Ornate armor, sword and shield; reused design |
| Healer | Owner's light mermaid spirit | Female anime face and costume; mermaid tail, not human legs |
| Mage | Owner's fire mermaid spirit | Female flame design; mermaid tail, not human legs |
| Rogue | CC0 AutoSprite Hooded Blade | Actual mesh has no blades; uses punch/kick skeletal clips |
| Enemy | CC0 AutoSprite goblin | Used across all encounters with scale/tint variations |

There are eight gameplay hero definitions but only four hero visual archetypes. Their number must not be described as eight unique completed models. Faces, costumes, topology and animation need a dedicated art pass for a consistent cast.

## Asset readiness

All five delivered GLBs have embedded buffers and textures, a skin and animations. File sizes and hashes are recorded in `public/assets/validation.json`. Total model transfer is approximately 14.1 MB. The models face +Z; the renderer rotates them for combat. Skeletal action clips are mapped by exact name in `manifest.json`. Missing rogue/enemy hurt/death clips have a small actor transform fallback; they are not newly authored skeletal animations.

## Next work

1. Design the two main human heroes with consistent anime faces, scale, palette and costume complexity.
2. Create or license textured models with separate usable weapons and mobile-appropriate topology.
3. Verify the rig and make idle, movement, attack, three cast/skill, hit and defeat animations.
4. Check silhouettes and faces from actual gameplay cameras on an iPhone, then replace manifest entries one at a time.
5. Add distinct recruited heroes, shop hero models, bosses and story environments.

The initial session did not spend generation credits. Fal reported an exhausted balance; Tripo was not authenticated. Do not imply that paid new character generation completed.
