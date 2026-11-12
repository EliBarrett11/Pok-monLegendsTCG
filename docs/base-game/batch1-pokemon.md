# Base Game · Batch 1 · Pokémon (B2, part 1)

Status: **awaiting Elliott's approval.** Designed to the budget in `design-bible.md`; every form at every Level scores within ±1.5 of its target, except Charizard (+2.5 at Levels 7 and 8, the accepted Heavy-payoff exception).

Card sheets (approved card design; grey panels are placeholders until the art arrives): `batch1/batch1-normal.jpg`, `-fire`, `-water`, `-grass`, `-electric`, `-legendary`.

Stats are Attack / Strength. Cost is ceil(Level / 2); Legendaries cost 5. Speed is per line unless a form says otherwise.

## Normal

### Eevee · Normal · Light · Steady · Physical · new
*Role:* Adapts to your team: best in mixed-Type decks.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Eevee | L1 1/2 · L2 2/2 · L3 2/3 · L4 3/3 · L5 4/4 · L6 5/5 | — | **On Summon:** +1 Attack and +1 Strength (kept) for each other Type among your Pokémon, up to +3. | +0 -1 -1 -1 -1 -1 |  |

### Meowth · Normal · Light · Swift · Physical · new
*Role:* High Roller money engine.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Meowth | L1 2/2 · L2 3/2 · L3 3/3 | Pickup | **On Summon:** Gain $1. | +0 -1 -1 |  |
| Persian | L4 4/3 · L5 5/4 · L6 6/5 | Pickup | **On Attack:** Gain $1. | -0.8 -0.8 -0.8 |  |

### Happiny · Normal · Heavy · Slow · Special · new
*Role:* Fortress healer; a wall that keeps a Location alive.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Happiny | L3 1/4 · L4 2/5 | — | **On Summon:** Heal 2 to each of your Pokémon. | -1 -1 |  |
| Chansey | L5 2/8 · L6 3/10 | Regenerate 2 | **On Breakfast:** Heal 1 to each of your other Pokémon in its Location. | +0.9 -0.1 |  |
| Blissey | L7 3/13 · L8 3/15 | Regenerate 2 | **Aura:** Your other Pokémon in its Location have Regenerate 1. | +1.4 +1.4 |  |

### Munchlax · Normal · Heavy · Slow · Physical · new
*Role:* Big Game / Late Bloomers: grows every Round it survives.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Munchlax | L3 2/4 · L4 3/5 · L5 4/7 | — | **On Breakfast:** +1 Strength (kept). | -0.8 -0.8 -0.8 |  |
| Snorlax | L6 5/8 · L7 7/10 · L8 8/11 | Sturdy | **On Breakfast:** +1 Attack and +1 Strength (kept). | +0.4 +0.4 +0.4 |  |

## Fire

### Ponyta · Fire · Light · Swift · Physical · re-tune
*Role:* Blitz.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Ponyta | L1 2/2 · L2 3/3 · L3 4/3 | — | **On Defeated:** Draw 1 card. | -0.6 -0.6 -0.6 | L2 3/2→3/3, L3 3/3→4/3 |
| Rapidash | L4 4/4 · L5 5/4 · L6 6/5 | Quick Attack | **On Knockout:** +1 Attack (kept). | +0.6 -0.4 -0.4 |  |

### Growlithe · Fire · Mid · Swift · Physical · re-tune
*Role:* Blitz.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Growlithe | L2 3/3 · L3 3/4 · L4 4/5 | — | **On Summon:** Your other Pokémon in its Location get +1 Attack until Supper. | +0.5 -0.5 -0.5 | L4 4/4→4/5 |
| Arcanine | L5 5/5 · L6 6/6 · L7 7/7 | Overrun | **On Knockout:** Draw 1 card. | -0.8 -0.8 -0.3 |  |

### Charmander · Fire · Heavy · Steady · Special · re-tune
*Role:* Blitz finisher.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Charmander | L3 2/4 · L4 3/4 | — | **On Attack:** +1 Attack (kept). | +0.2 -0.8 |  |
| Charmeleon | L5 4/6 · L6 5/7 | Rage | **On Summon:** 1 damage to an enemy Pokémon. | +1 -1 | L6 5/6→5/7 |
| Charizard | L7 7/8 · L8 8/9 | Overrun | **On Summon:** 2 damage to each enemy Pokémon. | +2.5 +2.5 | Swift. Heavy payoff exception |

### Magby · Fire · Heavy · Steady · Special · re-tune
*Role:* Board control.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Magby | L3 2/3 · L4 3/4 | — | **On Defeated:** 1 damage to each enemy Pokémon in its Location. | -0.6 -0.6 |  |
| Magmar | L5 4/5 · L6 5/7 | Retaliate 1 | **On Summon:** 1 damage to an enemy Pokémon. | +0 -1 | L6 5/6→5/7 |
| Magmortar | L7 7/7 · L8 8/8 | — | **On Attack:** 2 damage to each other enemy Pokémon in the target's Location. | -1.2 -1.2 | splash 1→2 damage |

## Water

### Squirtle · Water · Mid · Steady · Special · Defence guard · re-tune
*Role:* Fortress.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Squirtle | L2 2/4 · L3 2/5 | — | **On Summon:** Heal 2 to one of your Pokémon. | +0 -1 |  |
| Wartortle | L4 3/6 · L5 4/7 | Shell 1 | **On Summon:** Heal 2 to each of your Pokémon in its Location. | +1.5 +1.5 |  |
| Blastoise | L6 5/7 · L7 6/8 | Shell 1 | **On Attack:** 1 damage to another enemy Pokémon in the target's Location. | +0.8 +0.8 | splash 2→1, Strength −1 |

### Magikarp · Water · Heavy · Steady · Physical · re-tune
*Role:* Late Bloomers.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Magikarp | L3 1/4 · L4 1/5 · L5 3/6 | — | **On Summon:** Draw 1 card. | +0 -1 -1 | L5 2/5→3/6 |
| Gyarados | L6 6/8 · L7 8/9 · L8 9/10 | Rage | **On Summon:** 1 damage to each enemy Pokémon in its Location. | +1.5 +0.5 +0.5 | L6 7/8→6/8 |

### Horsea · Water · Mid · Steady · Special · re-tune
*Role:* Hit and Run.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Horsea | L2 2/4 · L3 3/4 | — | **On Summon:** 1 damage to an enemy Pokémon. | -0.5 -1.5 | +1 Strength |
| Seadra | L4 4/4 · L5 5/5 | Retaliate 1 | **On Summon:** 1 damage to an enemy Pokémon. | -1 -1 |  |
| Kingdra | L6 5/6 · L7 6/7 | Infiltrator | **On Summon:** 2 damage to an enemy Pokémon. | +1 +1 | Swift; −1 Attack |

### Wooper · Water · Mid · Slow · Physical · Defence guard · re-tune
*Role:* Fortress.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Wooper | L2 2/4 · L3 2/5 | Regenerate 1 | **On Summon:** +1 Strength (kept) to another of your Pokémon in its Location. | +0.7 -0.3 |  |
| Quagsire | L4 2/6 · L5 3/7 · L6 3/8 · L7 4/9 | Regenerate 1, Rage | **On Summon:** Heal 2 to each of your other Pokémon in its Location. | +0.5 +0.5 -0.5 -0.5 | −1 Strength at each Level |

## Grass

### Bulbasaur · Grass · Heavy · Steady · Special · new
*Role:* Territory / Late Bloomers.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Bulbasaur | L3 2/4 · L4 3/4 | Drain | **On Summon:** Heal 2 to one of your Pokémon. | +1.5 +0.5 |  |
| Ivysaur | L5 4/5 · L6 5/7 | Drain | **On Breakfast:** +1 Strength (kept). | -0.3 -1.3 |  |
| Venusaur | L7 7/9 · L8 8/10 | Drain | **On Dominate:** Heal 2 to each of your Pokémon. | -0.4 -0.4 |  |

### Oddish · Grass · Mid · Slow · Special · Special Defence guard · new
*Role:* Fortress / Afterlife: punishes attackers.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Oddish | L2 2/5 · L3 2/6 | — | **On Defend:** The attacker gets −1 Attack until Supper. | -0.2 -1.2 |  |
| Gloom | L4 3/6 · L5 3/8 | Retaliate 1 | **On Defend:** The attacker gets −1 Attack until Supper. | -0.7 -0.7 |  |
| Vileplume | L6 4/8 · L7 5/9 | Retaliate 1, Intimidate 1 | **On Breakfast:** 1 damage to each enemy Pokémon in its Location. | +1.4 +1.4 |  |

### Sunkern · Grass · Light · Slow · Special · new
*Role:* Late Bloomers / Territory.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Sunkern | L1 2/3 · L2 3/4 · L3 3/5 | — | **On Breakfast:** +1 Attack and +1 Strength (kept). | -0.6 -0.6 -0.6 |  |
| Sunflora | L4 3/5 · L5 4/6 · L6 5/7 | — | **On Breakfast:** +1 Attack and +1 Strength (kept) to each of your Pokémon in its Location. | +0.3 +0.3 +0.3 |  |

### Budew · Grass · Mid · Swift · Special · new
*Role:* Blitz / Afterlife.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Budew | L2 2/3 · L3 3/3 | — | **On Summon:** 1 damage to an enemy Pokémon. | -0.5 -1.5 |  |
| Roselia | L4 4/4 · L5 5/5 | Drain | **On Attack:** 1 damage to the enemy Player Character. | -0.1 -0.1 |  |
| Roserade | L6 6/5 · L7 7/6 | Drain | **On Summon:** 2 damage to an enemy Pokémon. | +1 +1 |  |

## Electric

### Chinchou · Electric · Light · Steady · Special · Special Defence guard · keep
*Role:* Big Game.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Chinchou | L1 1/3 · L2 2/3 · L3 2/4 | — | **On Summon:** +1 Energy this Round. | +0 -1 -1 |  |
| Lanturn | L4 3/5 · L5 4/6 · L6 4/7 | — | **On Attack:** 1 damage to each enemy Pokémon in its Location. | +0.4 +0.4 -0.6 |  |

### Shinx · Electric · Light · Swift · Physical · re-tune
*Role:* Blitz.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Shinx | L1 2/2 · L2 2/3 | — | **On Summon:** 1 damage to an enemy Pokémon. | -0.5 -1.5 |  |
| Luxio | L3 3/3 · L4 4/4 | Infiltrator | **On Knockout:** Draw 1 card. | +0.2 +1.2 |  |
| Luxray | L5 4/4 · L6 5/5 | Infiltrator | **On Summon:** 2 damage to an enemy Pokémon. | +1 +1 | L5 5/5→4/4, L6 6/5→5/5 |

### Pichu · Electric · Light · Swift · Special · new
*Role:* Hit and Run / Blitz: re-summon for more.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Pichu | L1 2/1 · L2 2/2 | Quick Attack | **On Summon:** 1 damage to the enemy across from it. | +0.2 -0.8 |  |
| Pikachu | L3 3/2 · L4 3/3 · L5 4/4 · L6 5/4 | Quick Attack | **On Summon:** 2 damage to the enemy across from it. | +0.4 +0.4 +0.4 -0.6 |  |

### Mareep · Electric · Mid · Slow · Special · Special Defence guard · new
*Role:* Big Game ramp engine.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Mareep | L2 2/4 · L3 2/5 | — | **On Summon:** +1 Energy this Round. | +0 -1 |  |
| Flaaffy | L4 3/6 · L5 4/7 | — | **On Breakfast:** +1 Energy this Round. | -0.6 -0.6 |  |
| Ampharos | L6 4/7 · L7 5/8 | — | **On Breakfast:** +2 Energy this Round. | -0.2 -0.2 |  |

## Legendary

### Entei · Fire · Legendary · Swift · Physical · new
*Role:* Blitz finisher.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Entei | L8 8/9 | Overrun, Quick Attack | **On Summon:** 3 damage to each enemy Pokémon in its Location. | +1.5 |  |

### Kyogre · Water · Legendary · Steady · Special · new
*Role:* Tidal tempo swing.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Kyogre | L8 8/11 | — | **On Summon:** 1 damage to each enemy Pokémon, and they become Spent. | +0.5 | Spent ×~2.5 enemies |

### Celebi · Grass · Legendary · Swift · Special · Special Defence guard · new
*Role:* Late Bloomers payoff: time travel.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Celebi | L8 7/10 | — | **On Summon:** Each Pokémon card in your hand gains +2 Levels. | -1 | ~3 cards |

### Zapdos · Electric · Legendary · Swift · Special · new
*Role:* Blitz / Big Game.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ | Note |
|---|---|---|---|---|---|
| Zapdos | L8 9/10 | Infiltrator, Agility | **On Attack:** 2 damage to the enemy Player Character. | -0.1 |  |

## Re-tunes to current cards

Ponyta L2–3, Growlithe L4, Charmeleon L6, Magmar L6, Magmortar (splash 2 to each other enemy), Blastoise (splash cut to 1, Strength −1), Magikarp L5, Gyarados L6, Horsea (+1 Strength), Kingdra (Swift, −1 Attack), Quagsire (−1 Strength at each Level), Luxray L5–6. Chinchou/Lanturn kept as they are.

## Next

Part 2: Batch 1 Moves, Supporters, Items, Locations (including re-tuning the four former Weather Locations), and the Trainers with their Partners.
