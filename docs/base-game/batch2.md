# Base Game · Batch 2 · Psychic, Fighting, Ghost, Dark (B2)

Status: **awaiting Elliott's approval.** Every card scores within ±1.5 of its budget (design bible section 3); every series keeps one theme. Art isn't waited for: cards without art use the Art Pending panel (Elliott, 12 Nov 2026).

Card sheets in `batch2/`: `series-psychic.jpg`, `-fighting`, `-ghost`, `-dark` (each series Level by Level; Mewtwo is on the Psychic sheet), then `batch2-moves.jpg`, `-supporters`, `-items`, `-locations`, `-trainers`.

Stats are Attack / Strength. Cost is ceil(Level / 2); Mewtwo costs 5.

## Psychic

### Abra series · Mid · Swift · Special
*Theme:* Every Move you play also zaps an enemy.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Abra | L2 2/2 · L3 3/3 | Agility | **On Command:** 1 damage to an enemy Pokémon. | -0.5 -0.5 |
| Kadabra | L4 4/4 · L5 5/5 | Agility | **On Command:** 1 damage to an enemy Pokémon. | -0.5 -0.5 |
| Alakazam | L6 6/5 · L7 7/6 | Agility | **On Command:** 2 damage to an enemy Pokémon. | +0 +0 |

### Ralts series · Mid · Steady · Special, Special Defence guard
*Theme:* Teleports a teammate home to replay its On Summon, a little stronger.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Ralts | L2 2/3 · L3 2/5 | — | **On Summon:** Return another of your Pokémon to your hand. | -0.5 -0.5 |
| Kirlia | L4 3/5 · L5 4/6 | — | **On Summon:** Return another of your Pokémon to your hand with +1 Level. | -0.5 -0.5 |
| Gardevoir | L6 4/7 · L7 5/8 | Agility | **On Summon:** Return another of your Pokémon to your hand with +2 Levels. | +0.5 +0.5 |

### Natu series · Light · Swift · Special
*Theme:* Sees ahead: a card every Breakfast it survives.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Natu | L1 2/2 · L2 3/2 · L3 3/3 | — | **On Breakfast:** Draw 1 card. | +0.4 -0.6 -0.6 |
| Xatu | L4 4/3 · L5 5/4 · L6 6/5 | Agility | **On Breakfast:** Draw 1 card. | +0.4 +0.4 +0.4 |

### Slowpoke series · Heavy · Slow · Special
*Theme:* Slow and steady: patches its Location up every Supper.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Slowpoke | L3 2/4 · L4 2/6 · L5 3/8 | — | **On Supper:** Heal 2 to each of your Pokémon in its Location. | -0.2 -0.2 -0.2 |
| Slowbro | L6 5/7 · L7 6/10 · L8 7/11 | Shell 1 | **On Supper:** Heal 3 to each of your Pokémon in its Location. | -0.3 -0.3 -0.3 |

### Mewtwo · Legendary · Swift · Special
*Theme:* Mind Games payoff: every Move you play becomes a blast.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Mewtwo | L8 10/10 | Agility | **On Command:** 2 damage to each enemy Pokémon in a Location. | +0 |

## Fighting

### Machop series · Heavy · Steady · Physical
*Theme:* Wins Locations and trains everyone who held them.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Machop | L3 2/2 · L4 3/3 | Rage | **On Dominate:** +1 Attack and +1 Strength (kept). | +0.1 +0.1 |
| Machoke | L5 4/4 · L6 5/7 | Rage | **On Dominate:** +1 Attack and +1 Strength (kept) to your Pokémon in its Location. | +0.4 +0.4 |
| Machamp | L7 7/7 · L8 8/8 | Rage | **On Dominate:** +1 Attack and +1 Strength (kept) to each of your Pokémon. | +0.3 +0.3 |

### Mankey series · Light · Swift · Physical
*Theme:* Fury: whoever beats it pays for it.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Mankey | L1 2/1 · L2 2/2 · L3 3/2 | Rage | **On Defeated:** 2 damage to the Pokémon that defeated it. | +0.6 -0.4 -0.4 |
| Primeape | L4 3/3 · L5 4/3 · L6 5/4 | Rage | **On Defeated:** 3 damage to the Pokémon that defeated it. | +0.7 -0.3 -0.3 |

### Riolu series · Mid · Swift · Physical
*Theme:* Its aura powers up the whole Location.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Riolu | L2 3/3 · L3 4/3 · L4 5/4 | — | **Aura:** Your other Pokémon in its Location have +1 Attack. | +0.5 -0.5 -0.5 |
| Lucario | L5 5/5 · L6 6/6 · L7 7/7 | — | **Aura:** Your other Pokémon in its Location have +1 Attack and +1 Strength. | +0 +0 +0 |

## Ghost

### Gastly series · Mid · Swift · Special
*Theme:* Keeps coming back: defeated, it returns to your hand.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Gastly | L2 2/2 · L3 3/2 | Stealth | **On Defeated:** Return it to your hand. | +0.4 -0.6 |
| Haunter | L4 3/3 · L5 4/4 | Stealth | **On Defeated:** Return it to your hand, and draw 1 card. | -0.2 -0.2 |
| Gengar | L6 5/5 · L7 6/5 | Stealth | **On Defeated:** Return it to your hand, and 2 damage to an enemy Pokémon. | +0.5 -0.5 |

### Duskull series · Heavy · Slow · Special
*Theme:* The reaper: brings your fallen back from the Discard.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Duskull | L3 2/4 · L4 2/6 | — | **On Summon:** Return a Pokémon card from your Discard Pile to your hand. | +0 +0 |
| Dusclops | L5 3/6 · L6 4/9 | Sturdy | **On Summon:** Return a Pokémon card from your Discard Pile to your hand. | +0 +0 |
| Dusknoir | L7 7/8 · L8 8/9 | Sturdy | **On Summon:** Return 2 Pokémon cards from your Discard Pile to your hand. | +0 +0 |

### Litwick series · Light · Steady · Special
*Theme:* Burns out in a blaze: damage when it is defeated, growing.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Litwick | L1 2/4 · L2 3/5 | — | **On Defeated:** 1 damage to each enemy Pokémon in its Location. | +0.4 +0.4 |
| Lampent | L3 3/4 · L4 4/4 | — | **On Defeated:** 2 damage to each enemy Pokémon in its Location. | -0.2 -0.2 |
| Chandelure | L5 5/5 · L6 6/6 | — | **On Defeated:** 2 damage to each enemy Pokémon. | +0.5 +0.5 |

## Dark

### Houndour series · Mid · Swift · Physical
*Theme:* The hunt: every knockout also hits the Player Character.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Houndour | L2 2/2 · L3 3/3 · L4 4/4 | Intimidate 1 | **On Knockout:** 2 damage to the enemy Player Character. | -0.3 -0.3 -0.3 |
| Houndoom | L5 4/4 · L6 5/5 · L7 6/6 | Intimidate 2 | **On Knockout:** 3 damage to the enemy Player Character. | -0.2 -0.2 -0.2 |

### Sneasel series · Light · Swift · Physical
*Theme:* Strikes from hiding and steals from the hand.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Sneasel | L1 2/1 · L2 3/2 · L3 3/3 | Stealth | **On Knockout:** The opponent discards a random card. | +0.2 +0.2 +0.2 |
| Weavile | L4 3/3 · L5 5/3 · L6 5/5 | Stealth | **On Knockout:** The opponent discards a random card, and you draw 1 card. | +0.4 +0.4 +0.4 |

### Absol series · Mid · Steady · Physical
*Theme:* Disaster on arrival: hits its whole Location.

| Form | Levels: Attack / Strength | Keywords | Trigger | Budget Δ |
|---|---|---|---|---|
| Absol | L2 2/3 · L3 3/4 · L4 4/5 · L5 5/6 · L6 6/7 · L7 7/8 | Intimidate 1 | **On Summon:** 1 damage to each enemy Pokémon in its Location. | +0.5 +0.5 +0.5 +0.5 +0.5 +0.5 |

## Moves

### Psychic · Psychic
*Damage that also weakens.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| React | 2 | 2 damage to the attacker, and it gets −1 Attack until Supper. | 4 / 4 |
| Adapt | 2 | 3 damage to an enemy Pokémon, and it gets −1 Attack until Supper. | 5.5 / 4.5 |
| Strat | 3 | 4 damage to an enemy Pokémon, and it gets −2 Attack until Supper. | 8 / 7.5 |

### Calm Mind · Psychic
*Cheap, lasting growth; feeds On Command.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| React | 1 | Your Pokémon being attacked gets +2 Strength until Supper. | 2 / 2 |
| Adapt | 1 | One of your Pokémon gets +1 Attack and +1 Strength (kept). | 2.4 / 2.2 |
| Strat | 2 | One of your Pokémon gets +2 Attack and +2 Strength (kept). | 4.8 / 5 |

### Close Combat · Fighting
*A huge hit that costs your fighter.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| Adapt | 2 | 4 damage to the enemy across from one of your Pokémon, and yours takes 1 damage. | 4.3 / 4.5 |
| Strat | 3 | 6 damage to the enemy across from one of your Pokémon, and yours takes 2 damage. | 6.2 / 7.5 |

### Detect · Fighting
*Read the blow and hit back.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| React | 1 | The attack deals 1 less damage, and 1 damage to the attacker. | 2.5 / 2 |
| Adapt | 1 | One of your Pokémon gets Retaliate 2 until Supper. | 2 / 2.2 |

### Shadow Ball · Ghost
*Damage, and a fallen card comes back.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| React | 1 | 2 damage to the attacker, before its attack. | 3 / 2 |
| Adapt | 2 | 3 damage to an enemy Pokémon. | 4.5 / 4.5 |
| Strat | 3 | 4 damage to an enemy Pokémon, and return a Pokémon card from your Discard Pile to your hand. | 8 / 7.5 |

### Destiny Bond · Ghost
*If it goes down, it takes the attacker with it.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| React | 2 | If your Pokémon being attacked is defeated, the attacker is defeated too. | 4 / 4 |
| Adapt | 1 | Until Supper, one of your Pokémon has "On Defeated: 3 damage to the Pokémon that defeated it." | 2 / 2.2 |

### Sucker Punch · Dark
*Punishes the Pokémon about to strike.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| React | 1 | 2 damage to the attacker, before its attack. | 3 / 2 |
| Adapt | 1 | 2 damage to an Active enemy Pokémon. | 2.4 / 2.2 |

### Thief · Dark
*Steals from the opponent's hand.*

| Mode | Cost | Effect | Points |
|---|---|---|---|
| React | 1 | Gain $2. | 2 / 2 |
| Adapt | 1 | The opponent discards a random card. | 2 / 2.2 |
| Strat | 2 | Put a random card from the opponent's hand into yours. | 4 / 5 |

## Supporters

| Supporter | Release | Effect | Favour | Points |
|---|---|---|---|---|
| Black Belt | 1 | One of your Pokémon gets +2 Attack and +2 Strength (kept). | Release a Fighting Pokémon: +3 and +3 instead. | 4.8 / 5.5 (Favour ×1.5) |
| Burglar | 1 | Put a random card from the opponent's hand into yours, and gain $1. | Release a Dark Pokémon: Gain $3 instead. | 5 / 5.5 (Favour ×1.4) |
| Officer Jenny | 1 | Each enemy Pokémon in a Location becomes Spent. | Release a Move: They also take 1 damage. | 5 / 5.5 (Favour ×1.4) |
| Bill | 1 | Put any 2 cards from your Draw Pile into your hand. | Release a Psychic Pokémon: 3 cards instead. | 5.5 / 5.5 (Favour ×1.45) |
| Mr. Fuji | 1 | Summon a Pokémon of Level 3 or less from your Discard Pile, for free. | Release a Ghost Pokémon: Level 5 or less instead. | 5 / 5.5 (Favour ×1.5) |
| Team Rocket Grunt | 1 | The opponent discards 2 random cards, and you gain $1. | Release a Dark Pokémon: 3 cards instead. | 5 / 5.5 (Favour ×1.4) |

## Items

| Item | Price | Kind | Stock | Effect | Points |
|---|---|---|---|---|---|
| Revive | $3 | Consumed | 4 | Summon a Pokémon of Level 4 or less from your Discard Pile, for free. | 6.5 / 7 |
| X Defend | $1 | Consumed | 8 | One of your Pokémon gets +3 Strength until Supper. | 2.4 / 3 |
| X Speed | $1 | Consumed | 8 | One of your Pokémon becomes Active, and its Speed is one step higher until Supper. | 2.5 / 3 |
| Ether | $2 | Consumed | 6 | +2 Energy this Round. | 4 / 5 |
| Choice Specs | $3 | Held | 4 | +2 Attack and Agility. | 3.4 / 4.5 |

## Locations

| Location | Lanes | Rounds | Passive |
|---|---|---|---|
| Shalour City | 3 | 3 | Pokémon here have Retaliate 1. |
| Lavender Town | 2 | 3 | When a Pokémon here is defeated, its owner draws 1 card. |
| Saffron City | 3 | 2 | Pokémon here have Agility. |

## Main Trainers and Partners

| Trainer | Command | Objective | Partner (Level 8, cost 4) | Points |
|---|---|---|---|---|
| Sabrina (Psychic) | 2: The opponent discards a card you choose. Draw 1 card. | Play 8 Moves as Adapt or Strat. | **Espeon** Swift, Special, 8/8, Agility; On Summon: 3 damage to an enemy Pokémon, and draw 1 card. | Command 5 / 4.5 · Partner 24.5 |
| Bruno (Fighting) | 2: One of your Pokémon gets +2 Attack and +2 Strength (kept). | Your Pokémon survive 8 enemy attacks. | **Hitmonchan** Steady, Physical, 8/10, Retaliate 1; On Summon: 3 damage to an enemy Pokémon. | Command 4.8 / 4.5 · Partner 24 |
| Morty (Ghost) | 1: Return a Pokémon card from your Discard Pile to your hand. | Return 5 cards from your Discard Pile. | **Mismagius** Swift, Special, 8/9, Stealth; On Summon: Return 2 Pokémon cards from your Discard Pile to your hand. | Command 2 / 2.2 · Partner 24 |
| Karen (Dark) | 2: 2 damage to the enemy Player Character, and a random discard. | Damage the enemy Player Character 8 times. | **Umbreon** Steady, Special, 7/12, Intimidate 1; On Summon: Each enemy Pokémon gets −2 Attack until Supper. | Command 4 / 4.5 · Partner 24.5 |

## Notes for B3 (engine) and B5 (balance)

- **New Objective counters:** Sabrina counts Moves played as Adapt or Strat; Bruno counts enemy attacks your Pokémon survive; Morty counts cards returned from your Discard Pile; Karen counts times the enemy Player Character takes damage. Targets (8, 8, 5, 8) are first guesses; B5 sets them.
- **New effects:** On Command and On Supper triggers (first uses), Aura (Riolu, Lucario), hand control (random discard, a chosen discard, taking a random card), summoning from the Discard Pile (Mr. Fuji, Revive), "return another of your Pokémon to your hand with +N Levels" (Ralts line), "On Defeated: return it to your hand" (Gastly line), Destiny Bond, damage "to the Pokémon that defeated it" (Mankey line), Lavender Town's draw on defeat.
- **Hand control and fairness:** no card makes the opponent discard more than 3 at once, and none repeats every Round, so nothing locks a player out (bible 3.9).
- **Short mode lines:** some Move lines on the card use the game's existing short forms ("Atk", "Str"); the full wording is in the Codex.

