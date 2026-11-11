# v4 gameplay update: rules, economy and the shared deck

**Status:** approved by Elliott on 10 November 2026, with his answers to Q1–Q3 built in. It replaces UX5 and UX6 for now; those stay in `docs/v4-ux-plan.md` for later.

**Why:** Elliott's playtest verdict was that v4 "is working well and very fun, but the basic deck holds back the vision of standard gameplay". This update makes the rule and economy fixes he asked for, and rebuilds the shared deck with more card variety.

**Numbers are starting values.** Every number below is a first pass for the AI-vs-AI simulation check in section 6, and can be tuned after Elliott plays.

---

## 1. What the measurements showed

These come from 40 AI-vs-AI matches on the current build (per player per match).

| Measure | Now | Problem |
|---|---|---|
| Recognition from damage to the Player | ~42 (56%) | |
| Recognition from defeats | ~23 (31%) | |
| Recognition from dominance | ~6 (8%) | Too small to fight over (Elliott's point 7) |
| Recognition from Favours | ~2 (2.5%) | Barely noticed (point 7) |
| Recognition from Objectives | ~3 (4%) | |
| PokéDollars earned | ~$30, of which ~$22 come from defeats paying the defeated Pokémon's cost | Too much money (point 6) |
| Items bought | ~8 | Money piles up |
| Battle Phase turns per Round (both players) | median 20 (16–24) | Used to size the PokéMart stock |
| Pokémon in the deck | 20 of 40 | Too many (deck point 1) |

---

## 2. Rule changes

### 2.1 Pass (Elliott's point 2)

**Today:** a player whose Ready Pokémon are faster than everything the opponent has can still Pass. When the opponent has just passed, that second Pass ends the Battle Phase at once, so the opponent's slower Pokémon never become Ready. The fast player controls how many attacks the opponent gets.

**New rule:** **you can't Pass while you have a Ready Pokémon with unmatched Speed.** Unmatched means the opponent has no Active Pokémon of the same Speed. You must attack with it, or take another action, first.

**Settled (Q1):** a Ready Pokémon can always target something at the moment, because guards are themselves legal targets. If a case ever arises where an unmatched Ready Pokémon has no legal target, you may Pass and it becomes Spent, as now.

### 2.2 React (point 3)

**New rule:** you can only React when the opponent **attacks with a Pokémon** or **uses a Command Card**. Summons can no longer be Reacted to.

**Settled (Q2):** you React to a Command when it **resolves**.
- **An Adapt** opens a React window when it's played, since it resolves at once.
- **A Strat** opens one when it resolves: at the start of its owner's next turn, or at Supper. Playing a Strat face-down can't be Reacted to.
- **Trainer Commands** can't be Reacted to.
- **A React** still can't be Reacted to.

### 2.3 Pokémon cost (point 4)

**Today:** `cost = ceil((Level − 1) / 2)`. Level 1 is free, and Levels 2 and 3 cost the same, so a Level 3 Charmander costs the same as a Level 2 Squirtle.

**New curve:** **`cost = ceil(Level / 2)`, half the Level rounded up.** Every odd Level costs 1 more than before, and nothing is free:

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Cost now | 0 | 1 | 1 | 2 | 2 | 3 | 3 | 4 |
| **New cost** | **1** | **1** | **2** | **2** | **3** | **3** | **4** | **4** |

**Fair across the series:** in any Round, a Heavy card is 2 Levels above a Light card and costs about 1 more Energy.

| Round | Base Energy | Light (Level, cost) | Mid | Heavy |
|---|---|---|---|---|
| 1 | 1 | L1, 1 | L2, 1 | L3, 2 |
| 3 | 3 | L3, 2 | L4, 2 | L5, 3 |
| 5 | 5 | L5, 3 | L6, 3 | L7, 4 |
| 7 | 7 | L6, 3 (max) | L7, 4 (max) | L8, 4 (max) |

- **Series roles:**
  - **Light** is the cheap early play, and the efficient filler once it caps.
  - **Mid** sits on the curve.
  - **Heavy** is a stretch early (usually needing Exert) and the strongest late.
- **Stats:** every new Pokémon's stats (section 4) are set against one value budget per Level, so a card's stats plus its effect and keywords are worth about the same at the same Level, whatever its series.
- **Partners:** Starmie and Ninetales stay Level 8, cost 4.

### 2.4 Recognition (point 7)

| Source | Now | **New** |
|---|---|---|
| Dominating a Location at Supper | +1 | **+3** |
| Completing a Supporter's Favour | +1 | **+3** |
| Dominating the Tournament | +3 | **+5** (×1.5 with its passive → 8) |
| Damage to the Player, defeats, Objectives | 1 per damage, +2, +2 | unchanged |

On today's numbers, dominance rises to roughly 20% of a player's Recognition and Favours to about 7%. That makes Locations worth contesting, and a Favour worth building a hand around.

Matches will get a little shorter. The simulation report (section 6) will show by how much. If the median match drops below 7 Rounds, the defeat reward is the first number to look at.

### 2.5 PokéDollars (point 6)

- **+$1 at each Breakfast** (unchanged).
- **+$1 for each enemy Pokémon you defeat,** flat, replacing "the defeated Pokémon's cost". A defeated Partner also gives $1.
- **Expected effect:** about $18 per player per match, down from about $30. That's enough for roughly one Item per Round at the new prices, so money feels tight and every purchase is a choice.

### 2.6 The PokéMart (point 1)

- **One Item, always on show** in the right-hand column, with its price, effect and a **Stock** counter of pips. There's no PokéMart button or drawer any more.
- **Stock = turns on sale.** Each turn taken by either player during the Battle Phase uses 1 Stock. At 0, the Item goes back to the pool and a new random Item replaces it. Stock carries over between Rounds; there's no refresh at Breakfast.
- **When it's bought** (settled, Q3), the PokéMart shows **Sold out** until the buyer has finished their next turn. Then a new random Item arrives with its full Stock. Buying it takes it away from the opponent too, and there's a short gap between Items. While it's sold out, there's no Stock counting down.
- **Dearer Items stay on sale for less time:**

  | Price | Stock (turns) |
  |---|---|
  | $1 | 8 |
  | $2 | 6 |
  | $3 | 4 |
  | $4 | 3 |

  With a median of 20 turns per Round, that's about 3–4 different Items on show each Round, more when players buy. Something new appears every few turns, which keeps the PokéMart worth watching.
- **The pool** holds one copy of every Item (section 5.3). Deck copies still return to the pool when used, as now, so the pool can hold duplicates.
- **Buying** still means using the Item at once or storing it in the Bag. A deck Item drawn into the hand is still bought from the hand.

### 2.7 Trainer Objective moments (point 5)

Inspired by Legends of Runeterra's Champion level-up track. Each time a player gains a point towards an Objective:

1. **The Trainer's portrait** slides in large from that player's side of the board, over a soft dark backdrop, with the Objective written underneath ("Defeat 8 enemy Pokémon").
2. **The progress track** sits below it: one pip per point. The new pip **stamps in** with a flash and a **"+1"** that rises, and the count ticks over ("3 → 4 / 8"). The Partner's portrait at the end of the track glows a little brighter with each point.
3. **When it's done,** the portrait slides back into the tracker, which pulses.
4. **Timing:** about 1.2 s at Normal speed, skippable with a click, and shown for the opponent's points too.
5. **On the final point,** a longer version plays: the track fills, the Trainer's portrait flares gold, and it leads straight into the existing Partner arrival.

---

## 3. The shared deck: shape

| Card type | Now | **New** | Copies |
|---|---|---|---|
| Pokémon | 20 (6 lines, 2–4 copies each) | **15** (10 lines) | 1–2 each |
| Command Cards (Pokémon moves) | 6 (4 different) | **9** (9 different) | 1 each |
| Supporters | 4 (3 different) | **5** (5 different) | 1 each |
| Items | 4 (3 different) | **5** (5 different) | 1 each |
| Locations | 4 | 4 | 1 each (unchanged) |
| Trainers | 2 | 2 | Misty, Blaine (unchanged) |
| **Total** | 40 | **40** | **37 different cards** (was 23) |

- **Hand size:** a 7-card hand now holds about 2–3 Pokémon, 1–2 Commands and about 1 each of Supporter, Item and Location. Every Round offers a real mix of choices.
- **X Attack** becomes an Item (5.3). It was a Command, but it's an object, and Command Cards are Pokémon moves.
- **Art:** all art already exists in `assets/cards`. **No new art is needed.**

---

## 4. Pokémon

### 4.1 Standard triggers and keywords

These are the terms v2 already settled, reused as they are.

**Triggers:**

| Trigger | Fires |
|---|---|
| **On Summon** | when this Pokémon arrives (summon or Partner). You choose its target if it has one. |
| **On Attack** | after this Pokémon attacks, if it survived |
| **On Defend** | when this Pokémon survives an attack that damaged it |
| **On Defeated** | when this Pokémon is defeated |
| **On Knockout** | when this Pokémon's attack, or its hit-back, defeats an enemy Pokémon |
| **On Breakfast** | at each Breakfast while this Pokémon is in play |

**Keywords:**

| Keyword | Meaning |
|---|---|
| **Quick Attack** | arrives Active instead of Spent |
| **Infiltrator** | its attacks ignore guards |
| **Overrun** | when its attack defeats an enemy Pokémon, the leftover damage hits the enemy Player Character, as Recognition for you |
| **Shell X** | each instance of damage it takes is X less, minimum 1 |
| **Regenerate X** | heals X at Breakfast |
| **Retaliate X** | when an attack damages it, the attacker takes X |
| **Rage** | +1 Attack for good each time it survives damage |

A Pokémon's trigger can change as it develops, as Magikarp's does. Every form has one trigger; some lines also have keywords. Text uses "an enemy Pokémon" for a chosen target, and "across from it" for the enemy Pokémon in the same lane.

### 4.2 The 10 lines

Stats are **Attack / Strength** at each Level. Speed is Slow, Steady or Swift. A guard is a Defence or Special Defence guard, as now.

**Light (Levels 1–6):**

| Line (copies) | Type, attack, Speed, guard | Forms by Level | Stats L1→L6 | Triggers and keywords |
|---|---|---|---|---|
| **Ponyta → Rapidash** (2) | Fire, Physical, Swift | Ponyta 1–3, Rapidash 4–6 | 2/2, 3/2, 3/3, 4/4, 5/4, 6/5 | **Ponyta:** On Defeated: draw 1 card. **Rapidash:** Quick Attack. On Knockout: +1 Attack (kept). |
| **Chinchou → Lanturn** (2) | Electric, Special, Steady, Sp. Def guard | Chinchou 1–3, Lanturn 4–6 | 1/3, 2/3, 2/4, 3/5, 4/6, 4/7 | **Chinchou:** On Summon: +1 Energy this Round. **Lanturn:** On Attack: 1 damage to each enemy Pokémon in its Location. |
| **Shinx → Luxio → Luxray** (1) *new* | Electric, Physical, Swift | Shinx 1–2, Luxio 3–4, Luxray 5–6 | 2/2, 2/3, 3/3, 4/4, 5/5, 6/5 | **Shinx:** On Summon: 1 damage to an enemy Pokémon. **Luxio:** Infiltrator. On Knockout: draw 1 card. **Luxray:** Infiltrator. On Summon: 2 damage to an enemy Pokémon. |

**Mid (Levels 2–7):**

| Line (copies) | Type, attack, Speed, guard | Forms by Level | Stats L2→L7 | Triggers and keywords |
|---|---|---|---|---|
| **Squirtle → Wartortle → Blastoise** (2) | Water, Special, Steady, Def guard | Squirtle 2–3, Wartortle 4–5, Blastoise 6–7 | 2/4, 2/5, 3/6, 4/7, 5/8, 6/9 | **Squirtle:** On Summon: heal 2 to one of your Pokémon. **Wartortle:** Shell 1. On Summon: heal 2 to each of your Pokémon in its Location. **Blastoise:** Shell 1. On Attack: 2 damage to another enemy Pokémon in the target's Location. |
| **Growlithe → Arcanine** (2) | Fire, Physical, Swift | Growlithe 2–4, Arcanine 5–7 | 3/3, 3/4, 4/4, 5/5, 6/6, 7/7 | **Growlithe:** On Summon: your other Pokémon in its Location get +1 Attack until Supper. **Arcanine:** Overrun. On Knockout: draw 1 card. |
| **Horsea → Seadra → Kingdra** (1) *new* | Water, Special, Steady (Kingdra Swift) | Horsea 2–3, Seadra 4–5, Kingdra 6–7 | 2/3, 3/3, 4/4, 5/5, 6/6, 7/7 | **Horsea:** On Summon: 1 damage to an enemy Pokémon. **Seadra:** Retaliate 1. On Summon: 1 damage to an enemy Pokémon. **Kingdra:** Infiltrator. On Summon: 2 damage to an enemy Pokémon. |
| **Wooper → Quagsire** (1) *new* | Water, Physical, Slow, Def guard | Wooper 2–3, Quagsire 4–7 | 2/4, 2/5, 3/7, 4/8, 4/9, 5/10 | **Wooper:** Regenerate 1. On Summon: +1 Strength (kept) to another of your Pokémon in its Location. **Quagsire:** Regenerate 1, Rage. On Summon: heal 2 to each of your other Pokémon in its Location. |

**Heavy (Levels 3–8):**

| Line (copies) | Type, attack, Speed | Forms by Level | Stats L3→L8 | Triggers and keywords |
|---|---|---|---|---|
| **Magikarp → Gyarados** (1) | Water, Physical, Steady | Magikarp 3–5, Gyarados 6–8 | 1/4, 1/5, 2/5, 7/8, 8/9, 9/10 | **Magikarp:** On Summon: draw 1 card (as now). **Gyarados:** Rage. On Summon: 1 damage to each enemy Pokémon in its Location. |
| **Charmander → Charmeleon → Charizard** (2) | Fire, Special, Steady (Charizard Swift) | Charmander 3–4, Charmeleon 5–6, Charizard 7–8 | 2/4, 3/4, 4/6, 5/6, 7/8, 8/9 | **Charmander:** On Attack: +1 Attack (kept). **Charmeleon:** Rage. On Summon: 1 damage to an enemy Pokémon. **Charizard:** Overrun. On Summon: 2 damage to each enemy Pokémon (as now). |
| **Magby → Magmar → Magmortar** (1) *new* | Fire, Special, Steady | Magby 3–4, Magmar 5–6, Magmortar 7–8 | 2/3, 3/4, 4/5, 5/6, 7/7, 8/8 | **Magby:** On Defeated: 1 damage to each enemy Pokémon in its Location. **Magmar:** Retaliate 1. On Summon: 1 damage to an enemy Pokémon. **Magmortar:** On Attack: 1 damage to each other enemy Pokémon in the target's Location. |

**Series mix:** Light 5, Mid 6, Heavy 4.

**Partners (unchanged apart from triggers):**
- **Starmie:** On Summon: draw 2 cards.
- **Ninetales:** On Summon: 2 damage to each enemy Pokémon.

**New attack animation:** Shinx's line is Electric Physical, which v4 doesn't have yet. It needs a charging spark rush, built from the existing lightning and impact effects.

---

## 5. Commands, Supporters and Items

### 5.1 Command Cards: Pokémon moves (9, one copy each)

The three modes work as today: React is cheaper and weaker, Adapt is the standard, and Strat is dearer and stronger (resolving later).

| Card | Target | React (cost: effect) | Adapt | Strat |
|---|---|---|---|---|
| **Ember** (kept) | an enemy Pokémon | 1: 2 damage | 2: 3 damage | 3: 5 damage |
| **Thunderbolt** *new* | an enemy Pokémon | 2: 2 damage | 3: 4 damage | 4: 6 damage |
| **Rock Slide** (kept) | a Location | 2: 1 damage to one enemy | 3: 1 damage to each enemy there | 4: 2 damage to each enemy there |
| **Heat Wave** *new* | all enemies | 2: 1 damage to the attacker | 3: 1 damage to each enemy Pokémon | 5: 2 damage to each enemy Pokémon |
| **Surf** *new* | a Location | 1: heal 2 to the Pokémon being attacked | 3: 2 damage to each enemy there | 4: 3 damage to each enemy there |
| **Bubble Beam** *new* | an enemy Pokémon | 1: the attacker becomes Spent after its attack | 2: 2 damage, and it becomes Spent | 3: 3 damage, and it becomes Spent |
| **Recover** (kept) | one of your Pokémon | 1: heal 2 | 2: heal 4 | 3: heal 8 |
| **Flame Charge** *new* | one of your Pokémon | 1: +1 Attack until Supper | 2: +1 Attack (kept) | 3: +2 Attack (kept) |
| **Dive** *new* | one of your Pokémon | 1: return it to your hand (the attack on it fizzles) | 1: return it to your hand | 2: return it to your hand and draw 1 card |

**Notes:**
- **Dive** returns the card to your hand, where it develops with the Rounds again. As a React it saves a Pokémon from a lethal attack, so it's the deck's clearest React.
- **Heat Wave and Surf as Reacts** respond to the attack, so they target the attacker or the Pokémon being attacked.

### 5.2 Supporters (5, one copy each)

All Supporters work as now: Release N other cards, then the Supporter's effect; a Favour gives the enhanced effect and **+3 Recognition**.

| Card | Release | Effect | Favour (Release a…) → effect |
|---|---|---|---|
| **Nurse Joy** (kept) | 1 | heal each of your Pokémon 2 | Water Pokémon → heal 4 |
| **Professor Oak** (kept, 1 copy) | 1 | a Pokémon card from your Draw Pile into your hand | Location → 2 Pokémon cards |
| **Brock** (kept) | 2 | +1 Strength (kept) to each of your Pokémon | Pokémon of Level 4+ → +2 Strength |
| **Flannery** *new* | 1 | each of your Pokémon +1 Attack until Supper | Fire Pokémon → +2 Attack until Supper |
| **Pokémon Breeder** *new* | 1 | a Pokémon card from your Discard Pile into your hand | Item → 2 Pokémon cards |

### 5.3 Items

**In the deck (5, one copy each):** Potion, Oran Berry, X Attack, Charcoal, Quick Claw.

**The PokéMart pool (one copy each; prices re-set for the lower income):**

| Item | Price | Stock | Type | Effect |
|---|---|---|---|---|
| Oran Berry | $1 | 8 | Consumed | heal 2 |
| Potion | $2 | 6 | Consumed | heal 4 |
| **X Attack** *now an Item* | $2 | 6 | Consumed | +2 Attack until Supper |
| Charcoal | $2 | 6 | Held | +1 Attack |
| Mystic Water | $2 | 6 | Held | +2 Strength |
| **Quick Claw** *new* | $3 | 4 | Held | Speed one step higher (Slow → Steady → Swift) |
| **Rocky Helmet** *new* | $3 | 4 | Held | Retaliate 2 |
| Leftovers | $3 | 4 | Held | Regenerate 1 |
| **Choice Band** (real effect) | $4 | 3 | Held | +3 Attack, but the holder can't hit back |
| **Amulet Coin** *new* | $4 | 3 | Consumed | gain 3 Recognition |

Choice Band's old placeholder effect ("+2 Attack until Supper") is now X Attack's, so Choice Band gets its own effect.

### 5.4 The full deck list (40)

- **Locations (4):** Cerulean Cape, Mt. Ember, Lake of Rage, Route 119.
- **Pokémon (15):**
  - Ponyta ×2, Chinchou ×2, Shinx;
  - Squirtle ×2, Growlithe ×2, Horsea, Wooper;
  - Magikarp, Charmander ×2, Magby.
- **Commands (9):** Ember, Thunderbolt, Rock Slide, Heat Wave, Surf, Bubble Beam, Recover, Flame Charge, Dive.
- **Supporters (5):** Nurse Joy, Professor Oak, Brock, Flannery, Pokémon Breeder.
- **Items (5):** Potion, Oran Berry, X Attack, Charcoal, Quick Claw.
- **Trainers (2):** Misty, Blaine.

---

## 6. How it will be checked

After the build, a 200-match AI-vs-AI report against these targets:

| Measure | Target |
|---|---|
| Median match length | 7–9 Rounds |
| First-player win rate | 45–55% |
| Recognition shares | damage 40–55%, defeats 20–30%, dominance 15–25%, Favours 5–10%, Objectives 5–10% |
| PokéDollars | ~$15–20 earned and 5–8 Items bought per player |
| PokéMart | 3–5 different Items on show per Round |
| Each card | played in at least 30% of the matches where it's drawn, with no card's win rate when played above 60% |

Anything out of range is reported with a suggested number to change. Elliott's playtest has the final say.

---

## 7. Decisions (10 November 2026)

- **Q1, Pass:** settled as in 2.1.
- **Q2, React:** settled as in 2.2.
- **Q3, PokéMart:** settled as in 2.6.
- **Q4:** sections 2–5 are approved as written.

## 8. Build stages

| Stage | Contents | Prompt |
|---|---|---|
| **G1: Rules and economy** | Pass, React, cost curve, Recognition, PokéDollars, the one-Item PokéMart with Stock, and Objective point moments. The deck is unchanged, so the game stays playable | `docs/prompts/v4-G1.md` |
| **G2: Pokémon** | The trigger and keyword system, the 10 new Pokémon lines, the Electric Physical attack animation, and the AI's understanding of triggers | `docs/prompts/v4-G2.md` |
| **G3: Cards, deck and balance** | The new Commands, Supporters and Items, the final 40-card deck, the new card animations, and the 200-match balance report | `docs/prompts/v4-G3.md` |

## 9. Later rulings

- **11 November 2026, Bubble Beam's React** was a dead effect: attacking already makes the attacker Spent. It's now **React, cost 1: the attack deals 2 less damage**. Adapt and Strat are unchanged.
- **11 November 2026, hidden Strats:** a waiting Strat is hidden from the other player until it resolves. They see a face-down card and its target, and the card is revealed when it resolves, with their React window. The AI never reads the player's sealed card.
