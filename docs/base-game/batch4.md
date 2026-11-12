# Base Game · Batch 4 · Ice, Poison, Ground, Flying, Bug (B2)

Status: **approved.** Every card scores within ±1.5 of its budget (design bible section 3); every series keeps one theme. Cards without art use the Art Pending panel.

Card sheets in `batch4/`: `series-ice.jpg`, `series-poison.jpg`, `series-ground.jpg`, `series-flying.jpg`, `series-bug.jpg` (each series Level by Level), then `batch4-moves.jpg`, `-supporters`, `-items`, `-locations`, `-trainers`.

Stats are Attack / Strength. Cost is ceil(Level / 2); Legendaries cost 5.

## Ice

### Snorunt series · Mid · Steady · Special
*Theme:* Freezes on arrival: one enemy, then its whole Location.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Snorunt | L2 3/3 · L3 4/4 · L4 5/5 | — | **On Summon:** An enemy Pokémon becomes Spent. | +0 +0 +0 |
| Glalie | L5 3/4 · L6 4/5 · L7 5/6 | Shell 1 | **On Summon:** Each enemy Pokémon in its Location becomes Spent. | +0 +0 +0 |

### Swinub series · Heavy · Slow · Physical
*Theme:* Its attacks chill the target's Attack.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Swinub | L3 2/5 · L4 3/6 | — | **On Attack:** The target gets −1 Attack until Supper. | +0.2 +0.2 |
| Piloswine | L5 4/6 · L6 6/8 | Shell 1 | **On Attack:** The target gets −1 Attack until Supper. | +0.2 +0.2 |
| Mamoswine | L7 7/8 · L8 8/9 | Shell 1, Overrun | **On Attack:** The target gets −2 Attack until Supper. | -0.1 -0.1 |

### Lapras series · Heavy · Steady · Special, Special Defence guard
*Theme:* A gentle ferry: shelters and heals its Location every Breakfast.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Lapras | L3 1/2 · L4 2/3 · L5 3/4 · L6 5/6 · L7 7/7 · L8 8/8 | Shell 1 | **On Breakfast:** Heal 2 to each of your Pokémon in its Location. | +0.8 +0.8 -0.2 -0.2 -1.2 -1.2 |

## Poison

### Ekans series · Light · Swift · Physical
*Theme:* Venom that saps the target's Attack.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Ekans | L1 2/3 · L2 3/4 · L3 4/4 | — | **On Attack:** The target gets −1 Attack until Supper. | +0.2 +0.2 +0.2 |
| Arbok | L4 3/3 · L5 4/4 · L6 5/5 | Retaliate 1 | **On Attack:** The target gets −2 Attack until Supper. | -0.1 -0.1 -0.1 |

### Zubat series · Light · Swift · Physical
*Theme:* A swarm that feeds its colony with every bite.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Zubat | L1 2/1 · L2 3/2 | Swarm | **On Attack:** Heal 1 to each of your Pokémon in its Location. | -0.1 -0.1 |
| Golbat | L3 3/3 · L4 4/3 | Swarm | **On Attack:** Heal 1 to each of your Pokémon in its Location. | -0.1 -0.1 |
| Crobat | L5 3/3 · L6 4/4 | Swarm, Infiltrator | **On Attack:** Heal 2 to each of your Pokémon in its Location. | -0.2 -0.2 |

### Koffing series · Mid · Slow · Special, Defence guard
*Theme:* Toxic fumes that wear enemies down every Supper.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Koffing | L2 2/4 · L3 3/5 · L4 4/6 | — | **On Supper:** Each enemy Pokémon in its Location gets −1 Attack (kept). | +0.4 +0.4 +0.4 |
| Weezing | L5 5/5 · L6 6/6 · L7 7/7 | — | **On Supper:** Each enemy Pokémon gets −1 Attack (kept). | -0.4 -0.4 -0.4 |

## Ground

### Diglett series · Light · Swift · Physical
*Theme:* Burrows in, holds ground, and strikes the Player Character.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Diglett | L1 2/1 · L2 2/2 · L3 3/2 | Stealth | **On Dominate:** 2 damage to the enemy Player Character. | +0.6 -0.4 -0.4 |
| Dugtrio | L4 3/3 · L5 4/4 · L6 5/5 | Stealth | **On Dominate:** 3 damage to the enemy Player Character. | +0.4 +0.4 +0.4 |

### Cubone series · Mid · Steady · Physical
*Theme:* Grief makes it strong: grows with your fallen Pokémon.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Cubone | L2 2/3 · L3 3/4 · L4 4/5 | — | **On Summon:** +1 Attack and +1 Strength (kept) for each Pokémon in your Discard Pile, up to +2. | -0.5 -0.5 -0.5 |
| Marowak | L5 5/5 · L6 6/6 · L7 7/7 | — | **On Summon:** +1 Attack and +1 Strength (kept) for each Pokémon in your Discard Pile, up to +4. | +0 +0 +0 |

### Phanpy series · Heavy · Slow · Physical, Defence guard
*Theme:* Wins ground, then shakes the earth.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Phanpy | L3 2/3 · L4 3/4 · L5 4/6 | — | **On Dominate:** 1 damage to each enemy Pokémon in its Location. | -0.4 -0.4 -0.4 |
| Donphan | L6 5/5 · L7 7/7 · L8 8/8 | Sturdy | **On Dominate:** 2 damage to each enemy Pokémon. | +0 +0 +0 |

## Flying

### Pidgey series · Mid · Swift · Physical
*Theme:* Strafing runs straight at the Player Character.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Pidgey | L2 2/2 · L3 3/3 | Infiltrator | **On Summon:** 1 damage to the enemy Player Character. | +0 +0 |
| Pidgeotto | L4 4/3 · L5 5/4 | Infiltrator | **On Summon:** 2 damage to the enemy Player Character. | +0 +0 |
| Pidgeot | L6 5/4 · L7 6/5 | Infiltrator | **On Summon:** 3 damage to the enemy Player Character. | -1 -1 |

### Wingull series · Light · Swift · Special, Special Defence guard
*Theme:* A ferry: carries a teammate home to be played again.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Wingull | L1 2/2 · L2 3/3 · L3 4/3 | — | **On Summon:** Return another of your Pokémon to your hand. | +0.5 +0.5 +0.5 |
| Pelipper | L4 3/2 · L5 4/3 · L6 5/4 | Agility | **On Summon:** Return another of your Pokémon to your hand, and draw 1 card. | +0.5 +0.5 +0.5 |

### Starly series · Light · Swift · Physical
*Theme:* Hit and run: strikes at once, and returns after a knockout.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Starly | L1 2/1 · L2 3/2 | Quick Attack | **On Knockout:** Return it to your hand. | -0.1 -0.1 |
| Staravia | L3 3/2 · L4 3/3 | Quick Attack, Intimidate 1 | **On Knockout:** Return it to your hand. | +0.4 +0.4 |
| Staraptor | L5 4/3 · L6 4/4 | Quick Attack, Intimidate 1 | **On Knockout:** Return it to your hand, and draw 1 card. | +0.6 -0.4 |

## Bug

### Caterpie series · Light · Slow · Special, Defence guard
*Theme:* Cheap, hardy, and pays you back when it falls.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Caterpie | L1 3/2 · L2 4/3 | — | **On Defeated:** Draw 1 card. | -0.6 -0.6 |
| Metapod | L3 2/5 · L4 2/6 | Shell 1 | **On Defeated:** Draw 1 card. | +0.4 +0.4 |
| Butterfree | L5 4/3 · L6 5/4 | Shell 1, Agility | **On Defeated:** Draw 2 cards. | -0.2 -0.2 |

### Sewaddle series · Mid · Steady · Physical
*Theme:* Looks after the little ones: shelters your small Pokémon.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Sewaddle | L2 2/3 · L3 3/4 | Swarm | **Aura:** Your Level 1–3 Pokémon in its Location have +1 Strength. | +0.2 +0.2 |
| Swadloon | L4 3/6 · L5 4/7 | Swarm | **Aura:** Your Level 1–3 Pokémon in its Location have +1 Strength. | +0.2 +0.2 |
| Leavanny | L6 6/6 · L7 7/7 | Swarm | **Aura:** Your Level 1–3 Pokémon in its Location have +1 Attack and +1 Strength. | +0.4 +0.4 |

### Scyther series · Mid · Swift · Physical
*Theme:* Fury Cutter: sharper with every swing.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Scyther | L2 3/3 · L3 4/4 · L4 5/5 | — | **On Attack:** +1 Attack (kept). | +0.2 +0.2 +0.2 |
| Scizor | L5 5/5 · L6 6/6 · L7 7/7 | Shell 1 | **On Attack:** +1 Attack (kept). | +0.2 +0.2 +0.2 |

## Moves

### Ice Beam · Ice
*Damage that freezes the target.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| Adapt | 3 | 4 damage to an enemy Pokémon, and it becomes Spent. | 8 / 6.8 |
| Strat | 4 | 5 damage to an enemy Pokémon, and it becomes Spent. | 9.5 / 10 |

### Blizzard · Ice
*Freezes a Location, or the whole board.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| Adapt | 3 | 1 damage to each enemy Pokémon in a Location, and they become Spent. | 7 / 6.8 |
| Strat | 5 | 2 damage to each enemy Pokémon, and they become Spent. | 12 / 12.5 |

### Toxic · Poison
*Poison that lasts.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| React | 1 | 1 damage to the attacker, and it gets −1 Attack (kept). | 2.7 / 2 |
| Adapt | 1 | An enemy Pokémon gets −2 Attack (kept). | 2.4 / 2.2 |
| Strat | 2 | An enemy Pokémon gets −2 Attack and −2 Strength (kept). | 4.8 / 5 |

### Sludge Bomb · Poison
*Damage that leaves lasting poison.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| Adapt | 2 | 3 damage to an enemy Pokémon, and it gets −1 Attack (kept). | 5.7 / 4.5 |
| Strat | 3 | 4 damage to an enemy Pokémon, and it gets −2 Attack (kept). | 8.4 / 7.5 |

### Earthquake · Ground
*Shakes everyone, yours a little too.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| Adapt | 3 | 3 damage to each enemy Pokémon, and 1 to each of yours. | 6 / 6.8 |
| Strat | 4 | 4 damage to each enemy Pokémon, and 1 to each of yours. | 8.5 / 10 |

### Dig · Ground
*Go underground, come back stronger.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| Adapt | 1 | One of your Pokémon gets Stealth until Supper and +1 Strength (kept). | 2.7 / 2.2 |
| Strat | 2 | One of your Pokémon gets Stealth until Supper and +2 Attack (kept). | 3.9 / 5 |

### Tailwind · Flying
*Your whole side moves first.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| Adapt | 1 | Your Pokémon's Speed is one step higher until Supper. | 2.5 / 2.2 |
| Strat | 2 | Your Pokémon become Active. | 5 / 5 |

### Aerial Ace · Flying
*A strike that can't be answered.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| Adapt | 2 | 3 damage to an enemy Pokémon. This can't be Reacted to. | 5 / 4.5 |
| Strat | 3 | 5 damage to an enemy Pokémon. This can't be Reacted to. | 8 / 7.5 |

### U-turn · Bug
*Hit, then pull your Pokémon back to replay it.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| Adapt | 1 | Return one of your Pokémon to your hand, and 1 damage to an enemy Pokémon. | 3.5 / 2.2 |
| Strat | 2 | Return one of your Pokémon to your hand, and 2 damage to an enemy Pokémon. | 5 / 5 |

## Supporters

| Supporter | Release | Effect | Favour | Points |
|---|---|---|---|---|
| Bug Catcher | 1 | Put 3 Pokémon cards of Level 3 or less from your Draw Pile into your hand. | Release a Bug Pokémon: 4 cards instead. | 5 / 5.5 (Favour ×1.4) |

## Items

| Item | Price | Kind | Stock | Effect | Points |
|---|---|---|---|---|---|
| Assault Vest | $3 | Held | 4 | +3 Strength. Moves deal 1 less damage to it. | 4.6 / 4.5 |

## Locations

| Location | Lanes | Rounds | Passive |
|---|---|---|---|
| Petalburg Woods | 3 | 2 | Pokémon here have Swarm. |
| Seafoam Islands | 2 | 3 | Pokémon here have Shell 1, but their Speed is one step lower. |
| Viridian Forest | 4 | 2 | Pokémon of Level 3 or less here have Stealth. |

## Main Trainers and Partners

| Trainer | Command | Objective | Partner (Level 8, cost 4) | Points |
|---|---|---|---|---|
| Koga (Poison) | 1: An enemy Pokémon gets −2 Attack (kept). | Lower enemy Pokémon's Attack 10 times. | **Muk** Slow, Special, 8/13, Retaliate 1; On Summon: Each enemy Pokémon gets −1 Attack (kept). | Command 2.4 / 2.2 · Partner 24.5 |

## Notes for B3 (engine) and B5 (balance)

- **New Objective counter:** Koga counts times an enemy Pokémon's Attack is lowered. Target 10 is a first guess; B5 sets it.
- **New effects:** kept −Attack (Koffing line, Toxic, Sludge Bomb, Koga, Muk), Cubone's growth from your Discard Pile, "this can't be Reacted to" (Aerial Ace), "On Knockout: return it to your hand" (Starly line), an Aura that only covers Level 1–3 Pokémon (Sewaddle line), Seafoam Islands' slower Speed, Assault Vest's "Moves deal 1 less damage to it".

## Library health check (all 180 cards)

Checked against the design bible's section 1 targets once every batch was designed.

- **Every card is within budget** (±1.5), apart from the written Charizard exception.
- **Strategy seeds:** every seed now has 20+ supporting cards. Afterlife and Swarm were at 18 and 19, so Mr. Fuji, Revive, Lavender Town, Pokémon Breeder (Afterlife) and Petalburg Woods, Bug Catcher, Viridian Forest, Pallet Town, Route 119 (Swarm) were tagged for the seeds they already support. No card text changed.
- **A guarded Pokémon in every Type:** fixed in this batch for Poison (Koffing), Ground (Phanpy), Flying (Wingull) and Bug (Caterpie), each paying 1 Strength for its guard. **Six Types from approved batches had none; Elliott approved the fix (12 Nov 2026) and it's applied:** (a guard for −1 Strength at every Level, same points): Normal: Munchlax → Snorlax (Special Defence); Fire: Magby → Magmar → Magmortar (Special Defence); Fighting: Machop → Machoke → Machamp (Defence); Ghost: Duskull → Dusclops → Dusknoir (Special Defence); Dark: Absol (Special Defence); Dragon: Dratini → Dragonair → Dragonite (Special Defence).

