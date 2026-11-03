# v2 Grass deck, "Engine" (Combo)

**Status: approved by Elliott (3 Nov).** V6 builds it. Numbers are first-pass values for the V7 balance pass.

## Identity in v2

- **Plan:** build an engine that makes **Growth** every Breakfast, then spend Growth to **train Pokémon on the board**, evolving them in play, which no other deck can do. Finish with **Solar Beam**, which turns stored Growth into a big hit on the enemy player.
- **Trade-off:** its Pokémon start weak and must survive long enough to grow. Fire's early race and Burn are its danger; Grass answers with guards (Bulbasaur, Sunkern, Swadloon, Metapod, Geodude, Sudowoodo), Sleep, and Douse on its own player character.
- **Training plan:** many standard and light lines, played early at low Levels on purpose, then grown on the board with Growth. Caps stay high, because Growth trains up to the cap.
- **From v1:** Breakfast Evolve and the Evolve action retire (v2-design 4). The G3 lessons stay: Rain-making Locations, Douse for the player character, guards early.
- **Neutrals from N1:** Metapod (now Caterpie → Metapod → Butterfree), Geodude (now → Graveler → Golem), Rock Slide, Brock. Sudowoodo becomes Bonsly → Sudowoodo.

## New rule: Nurture (approved: Claude's judgement, Elliott 3 Nov)

- **Nurture** (Battle Action, 0 Energy): spend **2 Growth** to **train 1** one of your Pokémon on the board (up to its cap). Each Pokémon can be Nurtured once per Round.
- Training into a new stage triggers **On Evolve** abilities (the v1 trigger, carried over).
- Growth is still gained by card effects (and Sun 4: each player +1 Growth at Breakfast), carries over between Rounds, and shows as the Growth tree on the field (v1's display, with its four images).

## Deck: 40 cards

| Pokémon | Strategy | Supporters | Trainers | Locations | Items |
|---|---|---|---|---|---|
| 17 | 8 | 4 | 3 | 4 | 4 |

---

## Pokémon (17)

Stats are **Attack/Strength** at each Level, L1 → L6.

| Line (stages by Level) | × | Rarity | Type · Attack · Speed · guard | Weight | Suggested cap | Stats L1 → L6 | Abilities by Level |
|---|---|---|---|---|---|---|---|
| **Bulbasaur** (L1–2) → **Ivysaur** (L3–4) → **Venusaur** (L5–6) | 3 | Common | Grass · Special · Steady · **Special Defence guard** (Bulbasaur only) | standard | 6 | 2/5 · 2/6 · 3/7 · 4/7 · 5/10 · 6/12 | **On Breakfast:** gain 1 Growth (Venusaur 2). Ivysaur **On Evolve:** Leech Seed an enemy Pokémon in its Location. Venusaur: Shell 1 |
| **Oddish** (L1–2) → **Gloom** (L3–4) → **Bellossom** (L5–6) | 3 | Common | Grass · Special · Steady | light | 6 | 2/4 · 3/4 · 3/5 · 3/6 · 4/8 · 5/9 | Oddish: **On Breakfast:** gain 1 Growth. Gloom **On Evolve or Summon:** put an enemy Pokémon in its Location to Sleep. Bellossom **On Evolve or Summon:** put each enemy Pokémon in its Location to Sleep; **On Attack:** gain 1 Growth |
| **Sunkern** (L1–3) → **Sunflora** (L4–6) | 3 | Common | Grass · Special · Slow · **Defence guard** (Sunkern only) | light | 6 | 2/6 · 3/6 · 3/7 · 5/7 · 5/8 · 6/8 | Weather 1 Sun (Sunflora 2 Sun). Sunkern: **On Breakfast:** gain 1 Growth. Sunflora: +2 damage with its attack while Sun is 4+ |
| **Sewaddle** (L1–2) → **Swadloon** (L3–4) → **Leavanny** (L5–6) | 3 | Common | Bug · Physical · Steady (Leavanny Swift) · **Defence guard** (Swadloon only) | standard | 6 | 3/4 · 3/5 · 2/8 · 2/9 · 6/7 · 7/8 | Sewaddle: **On Defeated:** gain 2 Growth. Swadloon: Shell 1. Leavanny: Infiltrator; **On Attack:** gain 1 Growth (Grass's Physical reach) |
| **Eevee** (L1–3) → **Leafeon** (L4–6) | 1 | Epic | Normal → Grass · Physical · Steady → Swift | standard | 6 | 2/4 · 3/4 · 3/5 · 5/6 · 6/6 · 7/7 | Eevee: **On Summon:** gain 1 Growth. Leafeon: **On Evolve:** train 1 another friendly Pokémon in its Location |
| **Caterpie** (L1–2) → **Metapod** (L3–4) → **Butterfree** (L5–6) *(neutral)* | 1 | Common | Bug · Special · Slow → Swift · **Defence guard** (Metapod only) | light | 6 | 1/4 · 1/5 · 1/7 · 1/8 · 5/6 · 6/7 | Metapod: Shell 1. Butterfree: Agility; **On Evolve:** put an enemy Pokémon to Sleep |
| **Geodude** (L1–2) → **Graveler** (L3–4) → **Golem** (L5–6) *(neutral)* | 1 | Rare | Rock · Physical · Slow · **Defence guard** | heavy | 6 | 3/6 · 3/7 · 4/8 · 5/9 · 7/11 · 8/12 | **On Defend:** 1 damage to the attacker (Golem: 2) |
| **Bonsly** (L1–3) → **Sudowoodo** (L4–6) *(neutral)* | 1 | Rare | Rock · Physical · Slow · **Defence guard** | standard | 4 | 1/6 · 2/6 · 2/7 · 3/9 · 4/9 · 4/10 | Shell 1 from Sudowoodo |
| **Celebi** *(Legendary, L7)* | 1 | Legendary | Grass · Special · Swift | heavy | 7 | L1–6: 2/5 … 6/8 · **L7: 7/9** | **On Summon:** gain 3 Growth. L7: **On Summon:** also train 2 every friendly Pokémon |

## Strategy Cards (8)

| Card | × | Rarity | Breakpoints |
|---|---|---|---|
| **Leech Seed** | 2 | Common | **1** (single cost): Leech Seed an enemy Pokémon |
| **Sleep Powder** | 1 | Common | **2** (single cost): put an enemy Pokémon to Sleep |
| **Synthesis** | 2 | Common | **1:** gain 2 Growth; heal a friendly Pokémon 2 and Douse it, or Douse your player character · **3:** gain 4 Growth; heal every friendly Pokémon in a chosen Location 3; Douse your player character |
| **Solar Beam** | 2 | Rare | **2:** spend up to 5 Growth: deal that much damage to an enemy Pokémon or the enemy player · **4:** spend up to 10 Growth, and the target can't be guarded. Retain |
| **Rock Slide** *(neutral)* | 1 | Rare | **3:** 2 damage to every enemy Pokémon in a chosen Location · **5:** 3 damage to every enemy Pokémon in a chosen Location, and 1 to every other enemy Pokémon |

## Supporters (4): Release only, no limit per Round

| Card | × | Rarity | Release | Effect | Favour | Favour bonus |
|---|---|---|---|---|---|---|
| **Mallow** | 1 | Common | 1 | Gain 3 Growth | a Grass Pokémon | Also train 1 a friendly Pokémon |
| **Pokémon Breeder** | 1 | Rare | 1 | Train 2 a friendly Pokémon | a Pokémon from an evolution line | Train 3 instead |
| **Professor Oak** | 1 | Rare | 2 | Draw 3 cards | a Pokémon card | Draw 4 instead |
| **Brock** *(neutral)* | 1 | Rare | 1 | Friendly Pokémon in a chosen Location gain +2 Strength and Shell 1 until your next Breakfast; Douse your player character | a Rock Pokémon | Every Location instead |

## Trainers (3): tiers at 2 / 4 / 6 Trainer Points

| Trainer | Passive (2) | Ability (4) | Partner (6) |
|---|---|---|---|
| **Erika** | Your Pokémon in her lane train 1 at Breakfast | (2) Put an enemy Pokémon to Sleep | **Vileplume** L5: Special · Slow · 5/10, **On Summon:** put each enemy Pokémon in its Location to Sleep |
| **Gardenia** | Nurturing a Pokémon in her lane costs 1 Growth less | (1) Gain 1 Growth | **Roserade** L5: Special · Swift · 6/5, **On Attack:** Leech Seed the target |
| **Ramos** | Leech Seeds on enemy Pokémon in his lane drain 1 more | (1) Leech Seed an enemy Pokémon in his lane | **Gogoat** L5: Physical · Steady · 6/8, Regenerate 2 |

## Locations (4): mostly Rain, generic objectives

| Location | × | Lanes | Weather | Lasts | Objective | Milestones | Completion |
|---|---|---|---|---|---|---|---|
| **Floaroma Meadow** | 2 | 2 | 2 Rain | 3 Rounds | Have 3 Pokémon in this Location at Supper | 2 (at Supper): heal each of your Pokémon here 2 | +3 Recognition, +1 Trainer Point |
| **Eterna Forest** | 1 | 3 | 1 Rain, 1 Sun | 4 Rounds | Summon 4 Pokémon into this Location | 2: draw 1 · 3: find an Item | +4 Recognition |
| **Petalburg Woods** | 1 | 2 | 2 Rain | 4 Rounds | Defeat 2 enemy Pokémon from this Location | 1: +1 Trainer Point | +4 Recognition, find an Item |

## Items (4 in the deck)

| Card | × | Type | Cost | Effect |
|---|---|---|---|---|
| **Miracle Seed** | 1 | Held | 1 | +1 Attack; a Grass Pokémon also gains Regenerate 1 |
| **Big Root** | 1 | Held | 2 | Healing the holder receives is +1; your Leech Seeds heal the holder first |
| **Rare Candy** | 1 | Consumed | 2 | Train 2 a friendly Pokémon |
| **Oran Berry** | 1 | Consumed | 1 | Heal a friendly Pokémon 3 and Douse it, or Douse your player character; a Grass Pokémon also gives 1 Growth. Retain |

---

## Art

**Have:** bulbasaur, ivysaur, venusaur, oddish, gloom, bellossom, sunkern, sunflora, sewaddle, swadloon, leavanny, eevee, metapod, geodude, sudowoodo, celebi, leech-seed, sleep-powder, synthesis, solar-beam, rock-slide, mallow, pokemon-breeder, professor-oak, brock, erika, gardenia, ramos, floaroma-meadow, eterna-forest, petalburg-woods, miracle-seed, big-root, rare-candy, oran-berry; the Growth tree (growth-1 … 4).

**Delivered (3 Nov):** vileplume, gogoat, roserade.

**Still needed (6):** leafeon, caterpie, butterfree, graveler, golem, bonsly. Eevee uses the same art in the Vaporeon and Leafeon lines until Elliott makes an alternative.

## Settled (3 Nov)

- **Nurture:** 2 Growth trains a Pokémon 1, once per Pokémon per Round (to be tuned in V7).
- **Eevee** is in both Water and Grass; both lines share the Eevee art for now.
- **Partners:** Vileplume (Erika), Roserade (Gardenia), Gogoat (Ramos).
- **Copies:** four Common lines at 3 copies, for a consistent engine.
