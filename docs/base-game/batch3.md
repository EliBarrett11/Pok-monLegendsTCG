# Base Game · Batch 3 · Rock, Dragon, Steel, Fairy (B2)

Status: **approved.** Guard update (12 Nov 2026, library health check): some series below gained a guard for −1 Strength at every Level; `cards.json` and the sheets have the current numbers. Every card scores within ±1.5 of its budget (design bible section 3); every series keeps one theme. Cards without art use the Art Pending panel.

Card sheets in `batch3/`: `series-rock.jpg`, `series-dragon.jpg`, `series-steel.jpg`, `series-fairy.jpg` (each series Level by Level), then `batch3-moves.jpg`, `-supporters`, `-items`, `-locations`, `-trainers`.

Stats are Attack / Strength. Cost is ceil(Level / 2); Legendaries cost 5.

## Rock

### Geodude series · Heavy · Slow · Physical, Defence guard
*Theme:* A rock wall that toughens its whole Location.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Geodude | L3 2/2 · L4 2/4 | Sturdy | **Aura:** Your other Pokémon in its Location have +1 Strength. | +0.5 +0.5 |
| Graveler | L5 4/5 · L6 5/7 | Sturdy | **Aura:** Your other Pokémon in its Location have +1 Strength. | +0.5 -0.5 |
| Golem | L7 7/8 · L8 8/9 | Sturdy | **Aura:** Your other Pokémon in its Location have +2 Strength. | +0 +0 |

### Larvitar series · Heavy · Steady · Physical
*Theme:* A sandstorm every Supper: its Location, then the whole board.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Larvitar | L3 2/3 · L4 3/4 | — | **On Supper:** 1 damage to each enemy Pokémon in its Location. | +0.4 +0.4 |
| Pupitar | L5 3/5 · L6 4/8 | Shell 1 | **On Supper:** 1 damage to each enemy Pokémon in its Location. | +0.4 +0.4 |
| Tyranitar | L7 6/7 · L8 8/8 | Shell 1, Overrun | **On Supper:** 1 damage to each enemy Pokémon. | -1 +0.5 |

### Bonsly series · Mid · Slow · Physical, Defence guard
*Theme:* Fortifies everyone beside it on arrival.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Bonsly | L2 1/3 · L3 2/4 · L4 3/5 | Sturdy | **On Summon:** +1 Strength (kept) to each of your other Pokémon in its Location. | +0 +0 +0 |
| Sudowoodo | L5 3/5 · L6 4/6 · L7 5/7 | Sturdy | **On Summon:** +2 Strength (kept) to each of your other Pokémon in its Location. | +0 +0 +0 |

## Dragon

### Dratini series · Heavy · Steady · Special
*Theme:* Untouchable by Moves, and it refills your hand on arrival.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Dratini | L3 2/2 · L4 3/3 | Agility | **On Summon:** Draw 1 card. | +0 +0 |
| Dragonair | L5 4/5 · L6 6/7 | Agility | **On Summon:** Draw 1 card. | +0 +0 |
| Dragonite | L7 7/7 · L8 8/8 | Agility, Overrun | **On Summon:** Draw 2 cards. | +0.5 +0.5 |

### Gible series · Heavy · Swift · Physical
*Theme:* Rough skin and a growing hunger: stronger with every knockout.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Gible | L3 2/2 · L4 3/2 | Retaliate 1 | **On Knockout:** +1 Attack and +1 Strength (kept). | +0.7 -0.3 |
| Gabite | L5 4/3 · L6 5/6 | Retaliate 1, Overrun | **On Knockout:** +1 Attack and +1 Strength (kept). | -0.3 -0.3 |
| Garchomp | L7 7/5 · L8 8/6 | Retaliate 2, Overrun | **On Knockout:** +2 Attack and +2 Strength (kept). | -0.1 -0.1 |

### Swablu series · Light · Steady · Special
*Theme:* Sings your hand to sleep: cards in hand grow faster.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Swablu | L1 2/4 · L2 3/4 · L3 4/5 | — | **On Breakfast:** A Pokémon card in your hand gains +1 Level. | +0.2 -0.8 +0.2 |
| Altaria | L4 3/3 · L5 4/4 · L6 5/5 | Agility | **On Breakfast:** Each Pokémon card in your hand gains +1 Level. | -0.4 -0.4 -0.4 |

### Rayquaza · Legendary · Swift · Physical
*Theme:* Sky dragon: every attack scorches the whole enemy side.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Rayquaza | L8 9/8 | Overrun, Agility | **On Attack:** 2 damage to each other enemy Pokémon. | +0.5 |

## Steel

### Aron series · Heavy · Slow · Physical, Defence guard
*Theme:* Armour that hits harder every time it is struck.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Aron | L3 2/2 · L4 3/3 | Shell 1 | **On Defend:** +1 Attack (kept). | -0.2 -0.2 |
| Lairon | L5 4/5 · L6 6/7 | Shell 1 | **On Defend:** +1 Attack (kept). | -0.2 -0.2 |
| Aggron | L7 7/7 · L8 8/8 | Shell 2 | **On Defend:** +2 Attack (kept). | -0.4 -0.4 |

### Magnemite series · Mid · Slow · Special, Defence guard
*Theme:* Pulls in PokéDollars every Breakfast.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Magnemite | L2 2/3 · L3 3/4 | Shell 1 | **On Breakfast:** Gain $1. | +0.2 +0.2 |
| Magneton | L4 4/5 · L5 5/6 | Shell 1 | **On Breakfast:** Gain $1. | +0.2 +0.2 |
| Magnezone | L6 5/7 · L7 6/8 | Shell 1 | **On Breakfast:** Gain $2. | +0.4 +0.4 |

### Beldum series · Heavy · Slow · Physical, Defence guard
*Theme:* Gets heavier with every attack.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Beldum | L3 1/3 · L4 2/4 | Sturdy | **On Attack:** +1 Strength (kept). | +0.2 +0.2 |
| Metang | L5 3/6 · L6 5/8 | Sturdy | **On Attack:** +1 Strength (kept). | +0.2 +0.2 |
| Metagross | L7 7/7 · L8 8/8 | Sturdy, Overrun | **On Attack:** +1 Attack and +1 Strength (kept). | -0.1 -0.1 |

## Fairy

### Clefairy series · Mid · Slow · Special, Special Defence guard
*Theme:* Every Move you play also heals.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Clefairy | L2 3/4 · L3 3/6 · L4 4/7 | — | **On Command:** Heal 2 to one of your Pokémon. | +0 +0 +0 |
| Clefable | L5 5/7 · L6 6/8 · L7 7/9 | — | **On Command:** Heal 2 to each of your Pokémon in its Location. | -0.5 -0.5 -0.5 |

### Togepi series · Mid · Steady · Special, Special Defence guard
*Theme:* Good fortune: Recognition on arrival.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Togepi | L2 2/4 · L3 3/5 | — | **On Summon:** Gain 1 Recognition. | +0.2 +0.2 |
| Togetic | L4 4/5 · L5 5/6 | — | **On Summon:** Gain 2 Recognition. | +0.4 +0.4 |
| Togekiss | L6 5/5 · L7 6/6 | Agility | **On Summon:** Gain 3 Recognition. | -0.4 -0.4 |

### Snubbull series · Light · Slow · Physical
*Theme:* Scares attackers off: one enemy, then its whole Location.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Snubbull | L1 2/3 · L2 3/4 · L3 4/4 | Intimidate 1 | **On Summon:** An enemy Pokémon gets −2 Attack until Supper. | +0.5 +0.5 +0.5 |
| Granbull | L4 4/3 · L5 5/4 · L6 6/5 | Intimidate 1 | **On Summon:** Each enemy Pokémon in its Location gets −2 Attack until Supper. | -0.3 -0.3 -0.3 |

## Moves

### Rock Slide · Rock · re-tune
*Rocks across a Location that also fortify your side.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| Adapt | 2 | 2 damage to each enemy Pokémon in a Location. | 4 / 4.5 |
| Strat | 3 | 3 damage to each enemy Pokémon in a Location, and your Pokémon there get +1 Strength (kept). | 8 / 7.5 |

### Dragon Dance · Dragon
*Powers a dragon up for good.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| Adapt | 1 | One of your Pokémon gets +1 Attack (kept), and its Speed is one step higher (kept). | 2.2 / 2.2 |
| Strat | 2 | One of your Pokémon gets +2 Attack (kept) and becomes Active. | 4.4 / 5 |

### Draco Meteor · Dragon
*The biggest hit in the game.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| Adapt | 4 | 6 damage to an enemy Pokémon. | 9 / 9 |
| Strat | 5 | 7 damage to an enemy Pokémon, and 2 to each other enemy in its Location. | 13.5 / 12.5 |

### Iron Defense · Steel
*Armour plating, now or for good.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| React | 1 | Your Pokémon being attacked gets Shell 2 until Supper. | 2 / 2 |
| Adapt | 2 | One of your Pokémon gets Shell 1 and +1 Strength (kept). | 3.6 / 4.5 |

### Flash Cannon · Steel
*Hits harder if you hold an Item.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| Adapt | 2 | 3 damage to an enemy Pokémon; 4 if one of your Pokémon holds an Item. | 5.3 / 4.5 |
| Strat | 3 | 5 damage to an enemy Pokémon; 6 if one of your Pokémon holds an Item. | 8.3 / 7.5 |

### Moonblast · Fairy
*Damage with a healing glow.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| React | 1 | 1 damage to the attacker, and heal 2 to your Pokémon being attacked. | 2.5 / 2 |
| Adapt | 2 | 3 damage to an enemy Pokémon, and heal 1 to each of your Pokémon. | 5.5 / 4.5 |
| Strat | 3 | 4 damage to an enemy Pokémon, and heal 2 to each of your Pokémon. | 8 / 7.5 |

### Misty Terrain · Fairy
*A protective mist over your side.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| React | 1 | The attack deals 1 less damage, and heal 1 to your Pokémon being attacked. | 1.5 / 2 |
| Adapt | 2 | Your Pokémon in a Location get Shell 1 until Supper, and heal 2 to each. | 3.5 / 4.5 |
| Strat | 3 | Your Pokémon get Shell 1 until Supper, and heal 4 to each. | 6 / 7.5 |

## Supporters

| Supporter | Release | Effect | Favour | Points |
|---|---|---|---|---|
| Hiker | 1 | +2 Strength (kept) and heal 2 to your Pokémon in a Location. | Release a Rock Pokémon: +3 Strength instead. | 5.1 / 5.5 (Favour ×1.35) |
| Ace Trainer | 2 | Draw 3 cards, and +1 Energy this Round. | Release a Pokémon of Level 6 or more: Draw 4 instead. | 8 / 8 (Favour ×1.25) |

## Items

| Item | Price | Kind | Stock | Effect | Points |
|---|---|---|---|---|---|
| Rare Candy | $1 | Consumed | 8 | A Pokémon card in your hand gains +3 Levels. | 3 / 3 |
| Escape Rope | $1 | Consumed | 8 | Return one of your Pokémon to your hand, and draw 1 card. | 3.5 / 3 |
| Focus Sash | $2 | Held | 6 | Sturdy. | 2 / 3 |
| Life Orb | $3 | Held | 4 | +3 Attack. When it attacks, it takes 1 damage. | 3 / 4.5 |

## Locations

| Location | Lanes | Rounds | Passive |
|---|---|---|---|
| Stark Mountain | 3 | 2 | At Supper, 1 damage to each Pokémon here. |
| Dragon's Den | 2 | 3 | Pokémon of Level 6 or more here have +1 Attack and +1 Strength. |
| Iron Island | 3 | 3 | Pokémon here have Shell 1. |

## Main Trainers and Partners

| Trainer | Command | Objective | Partner (Level 8, cost 4) | Points |
|---|---|---|---|---|
| Lance (Dragon) | 2: +1 Level to Pokémon cards in your hand, and +1 Energy. | Summon 4 Pokémon of Level 6 or more. | **Salamence** Swift, Physical, 9/9, Overrun; On Summon: 2 damage to each enemy Pokémon in its Location. | Command 5 / 4.5 · Partner 24.5 |
| Jasmine (Steel) | 1: Gain $2. | Give your Pokémon a Held Item 5 times. | **Steelix** Slow, Physical, 8/14, Shell 1; On Summon: Your Pokémon get Shell 1 until Supper. | Command 2 / 2.2 · Partner 25 |

## Notes for B3 (engine) and B5 (balance)

- **New Objective counters:** Lance counts Pokémon of Level 6 or more you summon; Jasmine counts Held Items you attach. Targets (4, 5) are first guesses; B5 sets them.
- **New effects:** Aura giving Strength (Geodude line), On Supper damage (Larvitar line), cards in hand gaining Levels at Breakfast (Swablu line), Recognition on summon (Togepi line), Flash Cannon's "if one of your Pokémon holds an Item", Life Orb's self-damage, Stark Mountain's damage at Supper (hits both sides).
- **Re-tuned:** Rock Slide (was Adapt 3: 1 damage in a Location; now Adapt 2: 2 damage there, and a Strat that also fortifies your side). It loses its React.
- **Short mode lines:** Rock Slide's and Draco Meteor's Strats use short card lines ("+1 Str", "splash 2"); the full wording is in the Codex.

