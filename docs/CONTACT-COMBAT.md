# Contact combat reference and implementation

Requested direction: melee heroes enter the monster formation and fight at weapon/body contact, following the feel of the original King's Raid. Rear-line heroes retain distance. Cosmetic beams cannot substitute for melee positioning.

## Reference review

- [King's Raid Gameplay Android/iOS, First Version 2016 — PROAPK](https://www.youtube.com/watch?v=brxDD5u8apU). Inspected playable footage near 40–47 seconds: a tutorial formation followed by an active skill exchange with forward heroes near the enemies and the support hero behind. Later seeks buffered or failed; this is a bounded review, not a claim to have watched the entire 30-minute video.
- [2017 Chapter 1 walkthrough — GoCaliberGaming](https://www.youtube.com/watch?v=4IbM8Nxd6mc). Located as an additional player reference; not visually reviewed.
- [Developer FAQ: hero placement](https://vespainc.oqupie.com/portals/1209/articles/24255). Melee heroes occupy the front; ranged heroes occupy centre/rear, with positions affected by attack/skill range.

The footage informs combat staging only. No King's Raid graphics, sounds or models are imported.

## Runtime behaviour

Attack mode is explicit per hero and separate from the existing role and saved hero ID. Kael, Riven, Astrid, Nova and Lucien fight in melee; Lyra, Seraphina and Elias attack at range.

The simulation advances living actors toward a target until the authored reach plus both body radii is satisfied. Melee attackers seek contact slots on their own side of an opponent and fan along a short arc. Soft body spacing limits stacked centres. Range checks gate every ordinary attack and its delayed hit. Ordinary hits resolve once after the attack wind-up; manual skill interruption cancels a queued ordinary hit.

Offensive melee skills requested out of range reserve mana/cooldown once, then approach their recipient before releasing. Defensive and healing skills remain castable from the current position. Repeated requests while a skill approach is pending are rejected. Pause and speed apply to movement and hit timing. Wave transitions retain living hero positions and select the next available target. Ending a battle clears transient intents.

The renderer reads simulation positions, turns models toward their targets and plays their real Run clips during approach. Melee swings use short local arcs; ranged attacks use projectile trails. Lunge distance is restrained to keep the bodies distinct at contact. These are original combat rules, not an exact reproduction of the reference game's AI.

Tests cover approach-before-damage, single delayed impact, one-time skill cost, paused intent, back-line separation, manual interrupts, stage outcomes and persistence. Browser screenshots are checked in both mobile orientations. Physical iOS performance remains unverified.
