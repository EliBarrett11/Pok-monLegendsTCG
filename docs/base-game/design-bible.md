# Base Game design bible

**Status:** B1, written 12 November 2026 for the Base Game plan (`docs/base-game-plan.md`). It's the rulebook every new card is designed against, and the card database (`docs/base-game/cards.csv`) scores every card with it.

**Calibration:** the numbers are calibrated on the current 10 Pokémon lines, which Elliott has playtested and is happy with. They score on target. The B5 simulations will correct any number that proves wrong.

---

## 1. What every card must be

1. **Good on its own.** Worth a slot in a plain deck of its Type. Synergy with a strategy seed is the bonus, never the reason it exists.
2. **One strong verb.** It can be described in five words: "Charizard burns the whole board", "Dive saves a Pokémon". A second ability appears only when it serves the same idea.
3. **A visible moment.** Something happens on the board when it's played or when it triggers: damage, a draw, a heal, a swing in a Location.
4. **Fair for its cost.** It scores within ±1.5 points of its budget (section 3). Anything outside that is a deliberate, written exception (e.g. a Heavy final form's payoff).
5. **Readable.** Templated wording (section 5), at most two lines of rules on a Full card, and only the 14 keywords and 9 triggers plus Aura.
6. **Interactive.** It pressures or answers the opponent's board. Big swings come on Strats and Reacts the opponent can see coming, or on Pokémon the opponent can attack.

**Library health targets:**
- **About a third of the library are staples:** general cards any deck can use.
- **Every Type has:**
  - at least one cheap and one expensive Pokémon;
  - at least one Pokémon with a guard;
  - at least one Move that deals damage or answers a threat;
  - access to healing or protection somewhere in its Moves.
- **Every strategy seed** has 20+ cards that support it.

---

## 2. What an Energy cost should buy

| Energy | Pokémon (Level it's played at) | Move (Adapt) | The feeling |
|---|---|---|---|
| **1** | Levels 1–2: a quick body with a small trigger | a trick; Reacts mostly live here | "That was efficient." |
| **2** | Levels 3–4: holds a lane, with a real trigger | 3 damage; defeats an early Pokémon | "A solid play." |
| **3** | Levels 5–6: a threat with an ability that matters | 4–5 damage, or a Location swing | "That changed the board." |
| **4** | Levels 7–8: an event; its arrival changes the board | Strats live here: a decisive answer | "Now they have to answer that." |
| **5** | Legendaries, the biggest Strats | match-defining | "That's the game if they don't deal with it." |

Pokémon cost is fixed by Level (`ceil(Level / 2)`). Within a cost, the budget (section 3) sets how strong it is.

---

## 3. The value budget

### 3.1 Pokémon: target points by series and Level

A form's **points** are its Attack + Strength plus the prices of its Speed, guard, keywords and trigger (section 3.2). The target:

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| **Light** (L1–6) | 7 | 9 | 10 | 11 | 13 | 15 | | |
| **Mid** (L2–7) | | 8 | 10 | 12 | 14 | 16 | 18 | |
| **Heavy** (L3–8) | | | 7 | 9 | 12 | 16 | 20 | 22 |
| **Legendary** (L8 only, cost 5) | | | | | | | | 26 |
| **Partner** (L8, free on arrival) | | | | | | | | 23–25 |

**The series shapes:**
- **Light** is strongest for its cost early and caps at Level 6.
- **Mid** is the straight line.
- **Heavy** is weak early (often a trigger and modest stats) and the strongest late. Its final form carries the payoff that justified waiting.

### 3.2 Prices

**Stats and body:**

| Item | Points |
|---|---|
| Attack or Strength | 1 each |
| Swift / Steady / Slow | +1 / 0 / −1 |
| Defence or Special Defence guard | +1 |

**Keywords:**

| Keyword | Points |
|---|---|
| Quick Attack | 2 |
| Infiltrator | 2 |
| Overrun | 1 (+0.5 if Attack 7+) |
| Shell X | 2 per X |
| Regenerate X | 1.5 per X |
| Retaliate X | 1.5 per X |
| Rage | 1.5 |
| Drain | 1.5 (+0.5 if Attack 6+) |
| Sturdy | 2 |
| Agility | 1 |
| Intimidate X | 1.5 per X |
| Swarm | 2 |
| Stealth | 2 |
| Pickup | 1 |

**Effects,** priced as On Summon. Other triggers multiply (3.3):

| Effect | Points |
|---|---|
| Draw N cards | 2 per card |
| Search the Draw Pile for a card | 2.5 |
| Return a card from the Discard to hand | 2 |
| +N Energy (this Round) | 2 per Energy |
| N damage to a chosen enemy Pokémon | 1.5 per damage |
| N damage to the enemy across from it | 1.2 per damage |
| N damage to each enemy in a Location | 2 per damage |
| N damage to each enemy Pokémon | 2.5 per damage |
| Heal N to one Pokémon | 0.5 per point |
| Heal N to each of yours in a Location | 0.75 per point |
| Heal N to each of yours | 1 per point |
| +N Attack or Strength, kept, to itself | 1 per point |
| +N Attack or Strength, kept, to another | 1.2 per point |
| +N Attack until Supper to others in its Location | 1 per point |
| −N Attack until Supper to an enemy | 1 per point |
| Make an enemy Spent | 2 |
| Make one of yours Active | 2 |
| Return one of yours to hand | 1 (more when it re-uses an On Summon) |
| Gain $N | 1 per $ |
| Gain N Recognition | 1.2 per point |

### 3.3 Trigger multipliers

| Trigger | ×   | Why |
|---|---|---|
| On Summon | 1.0 | happens once, when you choose |
| On Attack | 1.2 | usually fires 1–3 times |
| On Defend | 0.8 | the opponent chooses when |
| On Defeated | 0.7 | it has to die first |
| On Knockout | 0.6 | needs a defeat |
| On Breakfast | 1.2 | every Round it survives |
| On Supper | 1.2 | every Round it survives |
| On Command | 1.0 | fires with your Moves |
| On Dominate | 0.8 | needs the Location won |
| Aura | 1.5 | always on while in play |

**Conditions:** a condition ("if Level 6+", "if you control a Location") multiplies the price by **0.6–0.8**, depending on how easy it is to meet.

### 3.4 Calibration check: the current cards

Scored on the tables above, the current cards land on target:
- **Squirtle (L2):** 2/4 = 6, plus a guard (1) and "heal 2 to one" (1) = **8**, against a target of 8.
- **Arcanine (L7):** 7/7 = 14, plus Swift (1), Overrun (1.5) and On Knockout draw 1 (2 × 0.6 = 1.2) = **17.7**, against 18.
- **Ponyta (L1):** 2/2 = 4, plus Swift (1) and On Defeated draw 1 (1.4) = **6.4**, against 7.
- **Magikarp (L3):** 1/4 = 5, plus draw 1 (2) = **7**, against 7.
- **Charizard (L7):** 7/8 = 15, plus Swift (1), Overrun (1.5) and 2 damage to each enemy (5) = **22.5**, against 20. That's the written Heavy-payoff exception: the payoff for holding a Heavy card that long.

### 3.5 Moves (Command Cards)

| Mode | Value per Energy | Notes |
|---|---|---|
| **React** | about 2.0 | Cheaper and smaller, but it has timing: it answers. It acts on the action being Reacted to. |
| **Adapt** | about 2.25 | The standard. |
| **Strat** | about 2.5 | Bigger, because it's delayed, visible as a sealed card, and can be Reacted to when it resolves. |

- **Modes:** every Move has at least two of the three. Most have all three.
- **Shape:** React is cost 1–2, Adapt cost 2–3, Strat cost 3–5.
- **Example, Ember (Fire):** React 1: 2 damage (3); Adapt 2: 3 damage (4.5); Strat 3: 5 damage (7.5). On curve.

### 3.6 Supporters

- **The cost:** Release N other cards from hand (they leave the match), plus your turn.
- **Value:** the effect should be worth about **3 + 2.5 × N** points.
- **The Favour:** a named kind of card to Release. It upgrades the effect by about 50% and gives +3 Recognition. **Favour conditions should be met in about half the decks** that would play the Supporter: "a Water Pokémon", not "a Level 7 Water Pokémon".

### 3.7 Items

- **The price:** $1–4. Value is about **2 × price + 1** points.
  - **Consumed** Items do one thing now.
  - **Held** Items give a lasting effect (a keyword or +stat) worth about **1.5 × price** points. Held Items last, so they're priced lower per $.
- **PokéMart Stock** by price, as now: $1 → 8 turns, $2 → 6, $3 → 4, $4 → 3.

### 3.8 Locations

- **Shape:** free, 2–4 lanes, lasting 2–4 Rounds. Wider and longer means a milder passive.
- **The passive:** one clear rule about Pokémon **in that Location**, e.g. +1 Attack, +1 Strength, summoning costs 1 less (minimum 0), heal 1 at Breakfast, or Pokémon here have a keyword. With Weather gone, a Location is defined by its passive alone.
- **Ownership:** a Location's passive is symmetric (it applies to both players' Pokémon there) unless it says "your".
- **Dominance:** +3 Recognition at Supper, as now.

### 3.9 Main Trainers, Partners and Legendaries

- **Objectives:** completable in about Round 5–7 in a deck that leans into them (Misty 8, Blaine 5 are the reference). Each one tracks a thing its strategy does anyway.
- **Partners:** Level 8, budget 23–25. Their On Summon is a strong moment.
- **Trainer Commands:** Supporter-strength, about 2.25 points per Energy.
- **Legendaries:** Level 8, cost 5, budget 26, one copy each. Each has a single unmistakable signature effect. **No Legendary may lock the opponent out of playing.**

---

## 4. Triggers and keywords: exact rules

**Triggers.** The six existing ones work as built in G2 (`FOUNDATION_ASSUMPTIONS.md` 4b). The new ones:

| Trigger | Rule |
|---|---|
| **On Supper** | resolves at Supper after Strats and before dominance, in lane order, active player first |
| **On Command** | resolves after you play a Move as Adapt (when it resolves) or as Strat (when it's sealed). Reacts don't trigger it. |
| **On Dominate** | resolves at Supper, after dominance is decided, for each of your Pokémon in a Location you dominate |
| **Aura** | a constant effect while it's in play. It stacks across different Pokémon but not with itself (two copies of the same Aura count once). |

**Keywords.** The seven existing ones work as built. The new ones:

| Keyword | Rule |
|---|---|
| **Drain** | after its attack damages a Pokémon, it heals that much (up to its maximum). Not on hit-backs. |
| **Sturdy** | the first time each match it would be defeated, it stays at 1 Strength instead, and Sturdy is used up. Shown on the card until used. |
| **Agility** | the opponent's Moves can't choose it as a target. It's still hit by "each enemy" effects. |
| **Intimidate X** | enemy Pokémon in its Location (its lane, if it's in no Location) have −X Attack, minimum 0 |
| **Swarm** | +1 Attack for each other of your Pokémon in its Location |
| **Stealth** | it can't be attacked while you have another Pokémon in its Location. Moves can still target it. |
| **Pickup** | when its attack defeats a Pokémon, gain $1 |

---

## 5. Wording templates

Always write it these ways:

| Kind | Template |
|---|---|
| Trigger lines | "**On Summon:** 1 damage to an enemy Pokémon." (bold trigger, a colon, one sentence) |
| Choosing | "an enemy Pokémon" or "one of your Pokémon" means you choose. "the enemy across from it" means the same lane. "each enemy Pokémon in its Location" means in its own Location, or lane if it has none. |
| Duration | "until Supper" for temporary changes, "(kept)" for permanent ones |
| Numbers | "2 damage", "heal 3", "+1 Attack", "draw 1 card" |
| Conditions | first: "If it's Level 6 or more, draw 1 card." |
| Moves | each mode in one short line, starting with the verb: "3 damage", "Heal 4", "Return it to your hand" |

**Words never used:** Light, Mid, Heavy, Weather, Rain, Sun. Also no "you may", unless it's genuinely optional and the AI must decide.

---

## 6. Rarity and finish

| Rarity | Which cards | Finish |
|---|---|---|
| **Common** | most cards | the standard frame |
| **Rare** | the final form of every line, every Main Trainer, the best Moves and Supporters (about 25% of the library) | the holo from C2 |
| **Legendary** | the 6 Legendaries | a gold-foil frame variant and an animated holo |

Rarity never changes the rules, except for Legendaries' one-copy limit.

---

## 7. How each batch is designed

1. **Fill the gaps.** List the Types and seeds the batch covers, and what each one still lacks against the health targets in section 1.
2. **Design the cards** in the database: every number, effect and keyword, scored by the budget.
3. **Render them** in the approved card design (Full size), as images for Elliott to review. Elliott approves, changes or cuts them.
4. **Claude Code builds the batch:** the cards as data, any new effects and the art hooks.
5. **Balance:** a round robin of the starter decks. Out-of-range cards are re-tuned, and Elliott decides on any change.
