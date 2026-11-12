# Base Game · Batch 1 · Pokémon (B2, part 1, second pass)

Status: **approved.** Guard update (12 Nov 2026, library health check): some series below gained a guard for −1 Strength at every Level; `cards.json` and the sheets have the current numbers. Second pass after Elliott's feedback (12 Nov 2026): every series now has **one theme**: the same trigger and kind of effect at every form, growing bigger or wider, with keywords carrying forward (design bible 3.1). Every form at every Level scores within ±1.5 of its budget, except Charizard (+2.5 at Levels 7 and 8, the accepted Heavy-payoff exception).

Card sheets show each series Level by Level, the way the Library will: `batch1/series-normal.jpg`, `-fire`, `-water`, `-grass`, `-electric`, `-legendary`. Plain panels are placeholders until the art arrives.

Stats are Attack / Strength. Cost is ceil(Level / 2); Legendaries cost 5.

## Normal

### Eevee series · Light · Steady · Physical · new
*Theme:* Adapts to your team: best in mixed-Type decks.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Eevee | L1 1/2 · L2 2/2 · L3 2/3 · L4 3/3 · L5 4/4 · L6 5/5 | — | **On Summon:** +1 Attack and +1 Strength (kept) for each other Type among your Pokémon, up to +3. | +0 -1 -1 -1 -1 -1 |

### Meowth series · Light · Swift · Physical · new
*Theme:* Money: earns every time it attacks.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Meowth | L1 2/2 · L2 3/2 · L3 3/3 | Pickup | **On Attack:** Gain $1. | +0.2 -0.8 -0.8 |
| Persian | L4 3/3 · L5 4/4 · L6 5/5 | Pickup | **On Attack:** Gain $2. | -0.6 -0.6 -0.6 |

### Happiny series · Heavy · Slow · Special · new
*Theme:* Healing every Breakfast: its Location, then your whole side.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Happiny | L3 2/5 · L4 3/6 | — | **On Breakfast:** Heal 1 to each of your Pokémon in its Location. | -0.1 -0.1 |
| Chansey | L5 2/7 · L6 3/10 | Regenerate 1 | **On Breakfast:** Heal 2 to each of your Pokémon in its Location. | -0.7 -0.7 |
| Blissey | L7 3/12 · L8 3/14 | Regenerate 2 | **On Breakfast:** Heal 2 to each of your Pokémon. | -0.6 -0.6 |

### Munchlax series · Heavy · Slow · Physical · new
*Theme:* Grows every Breakfast it survives.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Munchlax | L3 2/4 · L4 3/5 · L5 4/7 | — | **On Breakfast:** +1 Strength (kept). | -0.8 -0.8 -0.8 |
| Snorlax | L6 5/8 · L7 7/10 · L8 8/11 | Sturdy | **On Breakfast:** +1 Attack and +1 Strength (kept). | +0.4 +0.4 +0.4 |

## Fire

### Ponyta series · Light · Swift · Physical · re-tune
*Theme:* Strikes at once and snowballs on knockouts.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Ponyta | L1 2/1 · L2 3/2 · L3 3/3 | Quick Attack | **On Knockout:** +1 Attack (kept). | -0.4 -0.4 -0.4 |
| Rapidash | L4 4/3 · L5 5/4 · L6 6/5 | Quick Attack | **On Knockout:** +2 Attack (kept). | +0.2 +0.2 +0.2 |

### Growlithe series · Mid · Swift · Physical · re-tune
*Theme:* Rallies the pack: its Location, then everyone.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Growlithe | L2 3/3 · L3 3/4 · L4 4/5 | — | **On Summon:** Your other Pokémon in its Location get +1 Attack until Supper. | +0.5 -0.5 -0.5 |
| Arcanine | L5 5/5 · L6 6/6 · L7 6/7 | Overrun | **On Summon:** Your other Pokémon get +1 Attack until Supper. | +0.5 +0.5 -0.5 |

### Charmander series · Heavy · Steady · Special · re-tune
*Theme:* Burns on arrival: one enemy, then a Location, then the whole board.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Charmander | L3 2/3 · L4 3/4 | — | **On Summon:** 1 damage to an enemy Pokémon. | -0.5 -0.5 |
| Charmeleon | L5 4/5 · L6 5/8 | — | **On Summon:** 1 damage to each enemy Pokémon in its Location. | -1 -1 |
| Charizard (Swift) | L7 7/8 · L8 8/9 | Overrun | **On Summon:** 2 damage to each enemy Pokémon. | +2.5 +2.5 |

### Magby series · Heavy · Steady · Special · re-tune
*Theme:* Splash damage on every attack, growing.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Magby | L3 2/3 · L4 2/4 | — | **On Attack:** 1 damage to another enemy Pokémon in the target's Location. | -0.2 -1.2 |
| Magmar | L5 4/5 · L6 5/8 | — | **On Attack:** 1 damage to each other enemy Pokémon in the target's Location. | -0.6 -0.6 |
| Magmortar | L7 7/7 · L8 8/8 | — | **On Attack:** 2 damage to each other enemy Pokémon in the target's Location. | -1.2 -1.2 |

## Water

### Squirtle series · Mid · Steady · Special, Defence guard · re-tune
*Theme:* Shelled healer: one Pokémon, then a Location, then everyone.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Squirtle | L2 2/3 · L3 2/4 | Shell 1 | **On Summon:** Heal 2 to one of your Pokémon. | +1 +0 |
| Wartortle | L4 3/5 · L5 4/6 | Shell 1 | **On Summon:** Heal 2 to each of your Pokémon in its Location. | +0.5 +0.5 |
| Blastoise | L6 4/7 · L7 5/8 | Shell 1 | **On Summon:** Heal 2 to each of your Pokémon. | +0 +0 |

### Magikarp series · Heavy · Steady · Physical · re-tune
*Theme:* Fury that builds: Rage and growing Attack, then Intimidate.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Magikarp | L3 1/3 · L4 1/5 · L5 3/6 | Rage | **On Breakfast:** +1 Attack (kept). | -0.3 -0.3 -0.3 |
| Gyarados | L6 5/7 · L7 7/8 · L8 8/9 | Rage, Intimidate 1 | **On Breakfast:** +1 Attack (kept). | +0.2 -0.8 -0.8 |

### Horsea series · Mid · Steady · Special · re-tune
*Theme:* Sniper: picks off a target on arrival, then reaches anywhere.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Horsea | L2 2/4 · L3 3/4 | — | **On Summon:** 1 damage to an enemy Pokémon. | -0.5 -1.5 |
| Seadra | L4 4/4 · L5 4/6 | Infiltrator | **On Summon:** 1 damage to an enemy Pokémon. | -0.5 -0.5 |
| Kingdra (Swift) | L6 5/6 · L7 6/7 | Infiltrator | **On Summon:** 2 damage to an enemy Pokémon. | +1 +1 |

### Wooper series · Mid · Slow · Physical, Defence guard · re-tune
*Theme:* Gets tougher each time it is attacked.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Wooper | L2 2/4 · L3 2/5 | Regenerate 1 | **On Defend:** +1 Strength (kept). | +0.3 -0.7 |
| Quagsire | L4 2/6 · L5 3/7 · L6 3/8 · L7 4/9 | Regenerate 1, Rage | **On Defend:** +1 Strength (kept). | -0.2 -0.2 -1.2 -1.2 |

## Grass

### Bulbasaur series · Heavy · Steady · Special · new
*Theme:* Holds ground: heals itself by attacking and your side when you win its Location.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Bulbasaur | L3 2/3 · L4 3/4 | Drain | **On Dominate:** Heal 2 to each of your Pokémon in its Location. | +0.7 +0.7 |
| Ivysaur | L5 4/6 · L6 5/8 | Drain | **On Dominate:** Heal 2 to each of your Pokémon. | +1.1 +0.1 |
| Venusaur | L7 7/9 · L8 8/10 | Drain | **On Dominate:** Heal 2 and +1 Strength (kept) to each of your Pokémon. | +1.2 +1.2 |

### Oddish series · Mid · Slow · Special, Special Defence guard · new
*Theme:* Punishes whatever attacks it.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Oddish | L2 2/5 · L3 2/6 | — | **On Defend:** The attacker gets −1 Attack until Supper. | -0.2 -1.2 |
| Gloom | L4 3/6 · L5 3/8 | Retaliate 1 | **On Defend:** The attacker gets −1 Attack until Supper. | -0.7 -0.7 |
| Vileplume | L6 4/8 · L7 5/9 | Retaliate 1 | **On Defend:** The attacker gets −2 Attack until Supper. | -0.9 -0.9 |

### Sunkern series · Light · Slow · Special · new
*Theme:* Growth every Breakfast: itself, then its whole Location.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Sunkern | L1 2/3 · L2 3/4 · L3 3/5 | — | **On Breakfast:** +1 Attack and +1 Strength (kept). | -0.6 -0.6 -0.6 |
| Sunflora | L4 3/5 · L5 4/6 · L6 5/7 | — | **On Breakfast:** +1 Attack and +1 Strength (kept) to each of your Pokémon in its Location. | +0.3 +0.3 +0.3 |

### Budew series · Mid · Swift · Special · new
*Theme:* Poison thorns: every attack also hits the Player Character.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Budew | L2 2/3 · L3 3/4 | — | **On Attack:** 1 damage to the enemy Player Character. | -0.6 -0.6 |
| Roselia | L4 4/4 · L5 5/5 | Drain | **On Attack:** 1 damage to the enemy Player Character. | -0.1 -0.1 |
| Roserade | L6 5/5 · L7 6/6 | Drain | **On Attack:** 2 damage to the enemy Player Character. | -0.6 -0.1 |

## Electric

### Chinchou series · Light · Steady · Special, Special Defence guard · re-tune
*Theme:* Pays for itself: Energy back on arrival.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Chinchou | L1 1/3 · L2 2/3 · L3 2/4 | — | **On Summon:** +1 Energy this Round. | +0 -1 -1 |
| Lanturn | L4 2/4 · L5 3/5 · L6 4/6 | — | **On Summon:** +2 Energy this Round. | +0 +0 +0 |

### Shinx series · Light · Swift · Physical · re-tune
*Theme:* Hunter: draws cards for every knockout.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Shinx | L1 2/2 · L2 3/3 | — | **On Knockout:** Draw 1 card. | -0.8 -0.8 |
| Luxio | L3 2/3 · L4 3/3 | Infiltrator | **On Knockout:** Draw 1 card. | -0.8 -0.8 |
| Luxray | L5 4/4 · L6 5/5 | Infiltrator | **On Knockout:** Draw 2 cards. | +0.4 +0.4 |

### Pichu series · Light · Swift · Special · new
*Theme:* Strikes on arrival and attacks at once.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Pichu | L1 2/1 · L2 2/2 | Quick Attack | **On Summon:** 1 damage to the enemy across from it. | +0.2 -0.8 |
| Pikachu | L3 3/2 · L4 3/3 · L5 4/4 · L6 5/4 | Quick Attack | **On Summon:** 2 damage to the enemy across from it. | +0.4 +0.4 +0.4 -0.6 |

### Mareep series · Mid · Slow · Special, Special Defence guard · new
*Theme:* Energy every Breakfast it survives.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Mareep | L2 2/3 · L3 2/5 | — | **On Breakfast:** +1 Energy this Round. | -0.6 -0.6 |
| Flaaffy | L4 3/6 · L5 4/7 | — | **On Breakfast:** +1 Energy this Round. | -0.6 -0.6 |
| Ampharos | L6 4/7 · L7 5/8 | — | **On Breakfast:** +2 Energy this Round. | -0.2 -0.2 |

## Legendary

### Entei series · Legendary · Swift · Physical · new
*Theme:* Blitz finisher.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Entei | L8 8/9 | Overrun, Quick Attack | **On Summon:** 3 damage to each enemy Pokémon in its Location. | +1.5 |

### Kyogre series · Legendary · Steady · Special · new
*Theme:* Tidal tempo swing.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Kyogre | L8 8/11 | — | **On Summon:** 1 damage to each enemy Pokémon, and they become Spent. | +0.5 |

### Celebi series · Legendary · Swift · Special, Special Defence guard · new
*Theme:* Late Bloomers payoff: time travel.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Celebi | L8 7/10 | — | **On Summon:** Each Pokémon card in your hand gains +2 Levels. | -1 |

### Zapdos series · Legendary · Swift · Special · new
*Theme:* Blitz / Big Game.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Zapdos | L8 9/10 | Infiltrator, Agility | **On Attack:** 2 damage to the enemy Player Character. | -0.1 |

## Next

Part 2: Batch 1 Moves, Supporters, Items, Locations (including the four former Weather Locations), and the Trainers with their Partners.
