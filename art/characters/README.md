# Editable starter characters

These packed Blender 5.2 files contain the owner's knight and priestess, original 30-bone rigs, materials and ten authored actions each. They open on Idle with a camera and studio lighting. Runtime GLBs are in `../../public/assets/models/` and are loaded through the manifest. Authoring files are outside the public/build directory and are not downloaded by players.

Read [the Thai hero and Blender guide](../../docs/STARTER-HEROES.md). Source geometry was reduced to about 80,000 triangles per hero while preserving UV seams. See the rig reports for source and export hashes. Facial animation, individual finger controls and physical cloth simulation are not included.

The reconstruction script is [build_starters.py](../../scripts/characters/build_starters.py). It needs the two original, unmodified source GLBs on the artist's machine. The packed `.blend` files can be edited directly without those source files. Back up direct edits before rebuilding from the script.
