# v4 foundation: assumptions

These are the decisions the approved design (`docs/v4-foundation-spec.md`, with section 16 first) doesn't settle exactly. Each entry gives:

- **Chosen:** what the code does.
- **Why:** why that's the simplest working option.
- **Approval:** **Needed** (a design or number choice Elliott may want to change) or **No** (it follows an earlier version or is a direct reading of the spec).

Numbers live in `v4/src/rules.js` and card data in `v4/src/engine/cards.js`. All values are starting values, not the result of balance testing.

## 1. Starting values (Recognition, Energy, PokéDollars)

| Value | Chosen | Why | Approval |
|---|---|---|---|
| Damage to a Player Character | 1 Recognition per damage | Section 16 sets it | No |
| Defeating an enemy Pokémon | +2 Recognition | A small round number, below a typical attack on the Player Character, which matches the spec's order of importance | **Needed** |
| Dominating a placed Location at Supper | +3 Recognition per Location (G1; was +1) | Gameplay update 2.4: dominance was too small to fight over | No (Elliott, 10 November 2026) |
| Completing a Supporter Favour | +3 Recognition (G1; was +1) | Gameplay update 2.4: a Favour worth building a hand around | No (Elliott, 10 November 2026) |
| Completing a Trainer Objective | +2 Recognition | Objectives take several turns, so worth a little more than a Favour | **Needed** |
| Specific card effects | No card gives Recognition directly; these Recognition sources are triggered by cards (Favours, Objectives, Commands that defeat a Pokémon) | No extra card design needed | **Needed** |
| Winning | 100 Recognition, at once, at any moment (also mid-action) | Spec; the only victory condition | No |
| Base Energy | v1: the Round number (max 10); Pass +1 except the Pass that ends the Battle Phase | Section 16 | No |
| Exert and Exhaust | v1 exactly: Exert maximum = Round (max 3); spent Exert is Exhausted for 2, 3 or 4 Rounds by position | Section 16 | No |
| Starting Energy | Round 1: Base Energy 1, Exert maximum 1 | Follows from v1's rule | No |
| PokéDollars per Round | +$1 at each Breakfast, including Round 1 | Spec "$1 per round" | No |
| PokéDollars per defeat | A flat +$1 for each enemy Pokémon defeated, Partners included, to its opponent, whatever caused it (G1; was its Energy cost) | Gameplay update 2.5: too much money; about $16 per player per match now (simulation) | No (Elliott, 10 November 2026) |

## 2. Round structure and the round-start (Breakfast) order

- **Chosen:**
  1. If the Tournament trigger is met, the Tournament begins.
  2. Exhaust recovers into Exert.
  3. Base Energy and the Exert maximum are set.
  4. Spent Pokémon become Active.
  5. +$1.
  6. Breakfast heals: Lake of Rage, the Rain 2 bracket, Leftovers.
  7. Cards off the battlefield take this Round's Level.
  8. Draw 7, less one per card Retained.
  9. Waiting Partners arrive.

  G1: the PokéMart no longer refreshes at Breakfast; its Item and Stock carry over between Rounds (section 9).

  In Round 1, after the draw, each player may mulligan (v1).
- **Match setup (UX1, Elliott's rule):** each player's 40 cards are shuffled into the Draw Pile, Trainers included. For each Trainer card in the deck, an Objective tracker goes into that player's Trainer area, linked to the card. It is active from Round 1, costs nothing and starts at progress 0. Then comes Round 1's Breakfast.
- **Supper order:**
  1. Pending Strats resolve, in the order played. G1: each may open a React window for the other player as it resolves; Supper waits for the window, then goes on.
  2. Dominance: placed Locations, or the Tournament.
  3. Trainer Objective progress from dominance.
  4. Location durations count down and expired Locations are removed.
  5. "Until Supper" effects end.
  6. The hand is discarded, except Retained cards.
- **Why:** v1's order, with each new step placed where its effect is needed: the Tournament first, so old passives don't apply that Breakfast; heals before the draw; Partners last.
- **Approval:** **Needed** (the order of the new steps).
- **Battle Phase:**
  - Initiative alternates each Round.
  - Players alternate one action per turn.
  - Two Passes in a row end the phase (v1).
  - **G1, Pass (gameplay update 2.1):** you can't Pass while you have a Ready Pokémon with unmatched Speed (the opponent has no Active Pokémon of the same Speed) that has a legal target: attack with it, or take another action, first. This applies to every Pass, including the one that would end the Battle Phase. If none of them has a legal target (with today's guards that can't happen, since a guard is itself always a target), you may Pass and they become Spent, as before. End turn is disabled with the reason; Space does nothing; the AI follows `legalActions`.
  - **Approval:** No (Elliott, Q1, 10 November 2026).

## 3. Hands and Retain

- **Chosen:**
  - **Draw and mulligan:** 7 at Breakfast; a Round 1 mulligan (v1).
  - **Supper:** the hand is discarded except Retained cards. The Discard Pile reshuffles into the Draw Pile when it runs out.
  - **Retain** is a Battle Phase action:
    - It costs 1 Energy and keeps one card through one Supper.
    - Each Retained card draws one fewer next Breakfast (never below 0).
    - **The Retain limit:** none beyond Energy and turns.
    - Any card type can be Retained.
- **Why:** section 16's wording, with no extra limit invented.
- **Approval:** **Needed** (no Retain limit; Retain uses the turn).

## 4. Pokémon development

- **Chosen:**
  - **Levels off the battlefield** (hand, Draw Pile and Discard Pile): the series' first Level in Round 1, +1 each Round, up to its maximum (Light 1–6, Mid 2–7, Heavy 3–8).
  - **On the battlefield:** a summoned Pokémon is a snapshot and doesn't develop.
  - **The cost curve (G1, gameplay update 2.3)** is `cost = ceil(Level / 2)` for every series: Level 1–2 cost 1, 3–4 cost 2, 5–6 cost 3, 7–8 cost 4. Nothing is free, and in any Round a Heavy card costs about 1 more than a Light one. Partners stay Level 8, cost 4.
- **Why:** one formula and one rule for all cards; the Discard Pile becomes the deck again, so it develops too.
- **Approval:** No for the cost curve (Elliott, 10 November 2026).
- **The six evolution paths** (stats per Level; abilities on Magikarp L3–5 "On Summon: draw 1" and Charizard L7+ "On Summon: 2 damage to each enemy Pokémon"):
  - Ponyta → Rapidash and Chinchou → Lanturn (Light);
  - Squirtle → Wartortle → Blastoise and Growlithe → Arcanine (Mid);
  - Magikarp → Gyarados and Charmander → Charmeleon → Charizard (Heavy).
  - **Why:** existing Pokémon and art, with simple numbers.
  - **Approval:** **Needed** (placeholder stats).

## 5. Speed, combat, guards and the Player Character

- **Chosen:**
  - **Ready and Spent** work as in v3:
    - A Ready Pokémon is the fastest Active one on both sides.
    - Summoned Pokémon arrive Spent.
    - G1: you can't Pass while a Ready Pokémon of yours with unmatched Speed has a legal target (section 2). Passing with unmatched Speed and no target makes those Pokémon Spent.
  - **Trades:** a Ready target hits back. A Pokémon at 0 Strength goes to the Released Pile.
  - **Guards:**
    - A Defence or Special Defence Pokémon protects its side's other Pokémon in the same Location.
    - It also protects its Player Character, but only against attackers of the matching kind standing in the guard's own Location.
  - **Commands** ignore guards. Commands and Items target Pokémon only, never a Player Character.
- **Why:** v3's rules; section 16's guard wording read literally.
- **Approval:** **Needed** (whether guards protect the Player Character only against the matching attack kind; whether Commands ignore guards).

## 6. Locations, Weather and dominance

- **Placing:**
  - **Chosen:** a Battle Phase action costing no Energy (v2). It covers the chosen lane and the lanes to its right, all free. Either player may place one, limited only by free lanes (so at most 4 at once).
  - **Why:** v2's placement; no separate limit invented.
  - **Approval:** **Needed** (no limit beyond lanes).
- **Durations:**
  - **Chosen:** Rounds left count down at Supper, after scoring. When a Location expires, its card goes to its owner's Discard Pile and its lanes are the Default Location again; Pokémon stay where they are.
  - **Why:** the simplest timing.
  - **Approval:** No.
- **Passives:**
  - **Chosen:** they apply to both players' Pokémon in the Location. A Pokémon already there gets the passive at once. Losing a Strength bonus never defeats a Pokémon (at least 1 Strength is left).
  - **Why:** symmetrical and simple.
  - **Approval:** **Needed**.
- **Weather brackets** (counts combine across placed Locations; each bracket applies to both players):
  - **Chosen:**
    - Rain 2: every Pokémon heals 1 at Breakfast.
    - Rain 4: every Pokémon has +1 Strength.
    - Sun 2: Physical attacks deal +1 damage.
    - Sun 4: every Pokémon has +1 Attack.
  - **Why:** two types and two simple brackets each, as section 16 suggests.
  - **Approval:** **Needed** (the values).
- **Dominance:**
  - **Chosen:** at Supper, for each placed Location, the player with the greater total current Strength there earns its Recognition. Ties and empty Locations give nothing. The Default Location is never scored.
  - **Why:** section 16.
  - **Approval:** No.
- **The four Locations** (placeholder values):

  | Location | Lanes | Rounds | Weather | Passive |
  |---|---|---|---|---|
  | Cerulean Cape | 2 | 3 | 1 Rain | +1 Strength |
  | Mt. Ember | 3 | 3 | 2 Sun | +1 Attack |
  | Lake of Rage | 2 | 2 | 1 Sun | Heal 2 at Breakfast |
  | Route 119 | 4 | 2 | 2 Rain | Summoning here costs 1 less |

  **Approval:** **Needed**.

## 7. Command Cards: React, Adapt and Strat timing

- **Eligibility:**
  - **Chosen (G1, gameplay update 2.2):** you can React only when the opponent attacks with a Pokémon or uses a Command Card, when it resolves:
    - an **attack**, when it's committed;
    - a Command played as **Adapt**, when it's played (it resolves at once);
    - a Command played as **Strat**, when it **resolves**: at the start of its owner's next turn, or at Supper (before dominance). Playing a Strat face-down can't be Reacted to.
    - **Summons**, Trainer Commands, Supporters, Items, Locations, Retain and Pass can't be Reacted to. A React can't be Reacted to.
    - When an attack or Adapt is committed, its cost is paid at once (Energy, and the card leaves the hand).
    - A React window opens for the other player only if they can pay for a React that has a target. They React with one card or let it happen.
  - **Why:** Elliott's rule (Q2, 10 November 2026).
  - **Approval:** No.
- **Timing and priority:**
  - **Chosen:**
    - The React resolves fully, then the committed action resolves against the new state.
    - The committed action fizzles, with its cost still paid, if its attacker or target is gone or the target is now guarded. A fizzled attack still makes the attacker Spent.
    - A React doesn't use a turn, and nothing can be reacted to in turn. There's no stack: at most one React per action.
  - **Why:** the smallest rule that "genuinely interrupts".
  - **Approval:** **Needed**.
- **Strat:**
  - **Chosen:**
    - It is paid and targeted when played, as that turn's action.
    - It resolves at the start of its owner's next turn, after the opponent's turn. If the Battle Phase ends first, it resolves at Supper, before dominance.
    - Pending Strats resolve in the order played. G1: as each one resolves, the other player gets a React window (the same banner, timer and keys); the rest wait for it. A resolving Strat isn't a turn. A React that removes its target makes it fizzle.
    - It fizzles if its target Pokémon is gone, even if another Pokémon now stands in that space. The cost stays paid.
  - **Why:** "after the opponent's next turn" read literally.
  - **Approval:** **Needed**.
- **The React window in the interface (UX1):**
  - **Chosen:** when the human player is the reactor, the game pauses with a banner, the committed action shown, and the playable React cards shown large.
  - A countdown runs (5 s by default; 8, 12 or 20 s in a setting). On timeout the interface sends the same `decline` as **Let it happen**.
  - The timer is interface-only: the engine has no timer, and tests and autoplay never wait.
  - **Approval:** No (Elliott's plan).
- **"Until Supper" effects:**
  - **Chosen:** X Attack and Choice Band last until that Round's Supper. So an X Attack Strat that resolves at Supper has no effect.
  - **Why:** one simple end point.
  - **Approval:** **Needed**.
- **The four Commands** (React cheaper and Strat dearer than Adapt; placeholder values):

  | Card | Target | Adapt | React | Strat |
  |---|---|---|---|---|
  | Ember | an enemy Pokémon | 2 Energy: 3 damage | 1: 2 damage | 3: 5 damage |
  | Recover | one of yours | 2: heal 4 | 1: heal 2 | 3: heal 8 |
  | X Attack | one of yours | 2: +2 Attack until Supper | 1: +1 | 3: +4 |
  | Rock Slide | an enemy Pokémon | 3: 1 damage to each enemy Pokémon in its Location | 2: 1 damage to it | 4: 2 damage to each |

  **Approval:** **Needed**.

## 8. Supporters: Release and Favour

- **Chosen:**
  - **Playing one:** a Battle Phase action costing no Energy, with no limit per Round. The player picks exactly N other cards from hand to Release.
  - **Release:** Released cards go to the Released Pile (never reshuffled, as in v2). Then the Supporter itself is Released.
  - **Favour:** met if any Released card meets its condition. It gives the enhanced effect and Recognition.
- **Why:** v2's Supporters.
- **Approval:** No for the rule; **Needed** for the values:

  | Supporter | Release | Effect | Favour: Release… | Enhanced |
  |---|---|---|---|---|
  | Nurse Joy | 1 | heal each of your Pokémon 2 | a Water Pokémon | heal 4 |
  | Professor Oak | 1 | the first Pokémon card in your Draw Pile into your hand | a Location | 2 Pokémon cards |
  | Brock | 2 | +1 Strength (kept) to each of your Pokémon | a Pokémon of Level 4+ | +2 |

## 9. Items, the PokéMart and the Inventory Bag

- **Purchase Item:**
  - **Chosen:** a Battle Phase action. You buy one Item from your hand or the PokéMart, then use it now (with a target) or store it in your Bag (6 spaces, v1).
    - There's no In Delivery wait: a stored Item can be used from your next turn.
    - G1: the PokéMart's Item, once bought, shows Sold out until the buyer has finished their next turn (section below).
    - An unbought Item in hand is discarded at Supper.
  - **Why:** v1's buying without its extra delay step.
  - **Approval:** **Needed** (no In Delivery).
- **Held and Consumed:**
  - **Chosen:** every Item targets one of your Pokémon in play.
    - **Held:** one per Pokémon; lost when that Pokémon is defeated.
    - **Consumed:** resolves, then leaves play.
    - Used and lost Items go to the PokéMart's pool, including deck copies (as in v1), so the pool can hold duplicates.
  - **Why:** v1's rule.
  - **Approval:** **Needed** (one Held Item each).
- **The PokéMart:**
  - **Chosen (G1, gameplay update 2.6):** one shared pool with one copy of each of the six Items, and **one Item on sale**, always on show in the right-hand column with its **Stock** (turns on sale):
    - Each turn taken by either player in the Battle Phase uses 1 Stock (React decisions and resolving Strats aren't turns; the Pass that ends the Battle Phase is). At 0 the Item goes back to the pool and a random Item from the pool replaces it, with full Stock.
    - Stock carries over between Rounds; there's no refresh at Breakfast.
    - When it's bought, the PokéMart shows **Sold out** until the buyer has finished their next turn (the turn of the purchase doesn't count); then a random Item arrives with full Stock. Nothing counts down while it's Sold out.
    - Match setup puts the first random Item on sale.
  - **Why:** Elliott's rule (Q3, 10 November 2026).
  - **Approval:** No.
  - **Settled here (not in the update):** the replacement Item is chosen from the pool without the one that just ran out, when the pool has another, so the Item on show always changes. **Needed**.
- **The six Items** (placeholder values; G1 adds their Stock: $1 → 8, $2 → 6, $3 → 4): Potion, Charcoal and Choice Band are in the deck; the others are only in the PokéMart.

  | Item | Price | Type | Effect |
  |---|---|---|---|
  | Potion | $2 | Consumed | heal 3 |
  | Oran Berry | $1 | Consumed | heal 2 |
  | Choice Band | $2 | Consumed | +2 Attack until Supper |
  | Charcoal | $2 | Held | +1 Attack |
  | Mystic Water | $2 | Held | +2 Strength |
  | Leftovers | $3 | Held | heal 1 at each Breakfast |

  **Approval:** **Needed**.

## 10. Trainers and Partners (UX1: Objectives are active from the start)

- **The rule (settled by Elliott, UX1):**
  - Trainer cards stay shuffled into the 40-card deck.
  - Each Trainer's Objective is tracked from match setup: active from Round 1, free, progress 0.
  - A drawn Trainer can only be played as its Trainer Command. It's then discarded and keeps cycling through the deck. Playing the Command doesn't affect its Objective.
  - There's no "play as Objective" action.
  - **On completion:**
    - The Trainer card is taken at once from wherever it is (Draw Pile, hand whether Retained or not, or Discard Pile) and leaves the deck for good. The deck is then 39 cards.
    - Its Partner arrives in your first free space, or waits for one.
    - Its On Summon resolves.
    - You gain the Objective's Recognition.
  - The tracker stays in the Trainer area, ticked, and makes no further progress.
  - **Approval:** No (Elliott's rule).
- **Where the completed card goes:**
  - **Chosen:** it's kept only on the tracker. It isn't in the Draw Pile, hand, Discard Pile or Released Pile.
  - **Why:** "removed from the deck for good" without counting it as a Released card.
  - **Approval:** **Needed**.
- **A Trainer card already Released:**
  - **Chosen:** if a Supporter Released the Trainer card before its Objective completed, the Objective still completes as normal: Partner and Recognition. The log says the card had already left the deck.
  - **Why:** the Objective is tracked independently of the card.
  - **Approval:** **Needed**.
- **Partners:**
  - **Chosen:**
    - The Partner arrives in your first (leftmost) empty space, Spent, like a summon.
    - With no free space it waits, and arrives as soon as one frees (checked after every action and at Breakfast).
    - A defeated Partner goes to the Released Pile.
  - **Why:** v2's Partners.
  - **Approval:** **Needed** (the leftmost space).
- **Trainer Command:**
  - **Chosen:** a Battle Phase action with its own Energy cost. It resolves at once, then the card is discarded. It can't be reacted to.
  - **Why:** the spec.
  - **Approval:** No.
- **The two Trainers** (placeholder values):

  | Trainer | Objective | Partner (On Summon) | Trainer Command |
  |---|---|---|---|
  | Misty | Defeat 8 enemy Pokémon | Starmie, Level 8: Swift, Special Attack 8, Hitpoints 10 (On Summon: draw 2) | 1 Energy: draw 2 |
  | Blaine | Dominate a Location 5 times (each Location dominated at a Supper counts 1; the Tournament counts 1) | Ninetales, Level 8: Steady, Special Attack 9, Hitpoints 11 (On Summon: 2 damage to each enemy Pokémon) | 2 Energy: 1 damage to each enemy Pokémon |

  - **Approval:** No (UX2, Elliott's Q5 and Q7).
  - The targets 8 and 5 and the Level 8 Partners make an Objective a mid-to-late-game reward. Defeating a Partner gives its opponent $1, like any Pokémon (G1).
  - Blaine's Trainer Command keeps its 1 damage; only Ninetales's On Summon went up to 2.

## 11. The Pokémon League Tournament

- **Trigger:**
  - **Chosen:** at Breakfast at the start of Round 10, or at the first Breakfast where either player has 70+ Recognition, whichever comes first. It's checked first at Breakfast and never mid-Round.
  - **Why:** Elliott's starting value, using the existing Round and Recognition systems.
  - **Approval:** No for the rule; **Needed** for the values 10 and 70.
- **The transition:**
  - **Chosen:**
    - All placed Locations are removed; their cards go to their owners' Discard Piles.
    - The Tournament Location covers all 9 lanes, and Pokémon stay where they are.
    - Location passives and Weather no longer apply.
    - No Location can be placed for the rest of the match; Location cards say why.
    - The Tournament lasts until the match ends.
  - **Why:** Elliott's F5 rules.
  - **Approval:** No.
- **Passive:**
  - **Chosen:** all Recognition earned during the Tournament, from every source, is increased by half, rounded up (1 → 2, 3 → 5, 4 → 6).
  - **Why:** Elliott's rule.
  - **Approval:** No.
- **Dominance:**
  - **Chosen:** at each Supper, more total current Strength across the battlefield earns +5 Recognition (G1; was +3), which becomes 8 with the passive. Ties give nothing. It also counts as "dominating a Location" for Blaine's Objective.
  - **Why:** Elliott's rule; the Tournament is a Location.
  - **Approval:** **Needed** (whether it counts for Blaine).
- **Guards:** during the Tournament every lane is in one Location, so a guard protects its whole side.
  - **Why:** the existing guard rule.
  - **Approval:** No.
- **Stalling:** a match can only stall if neither player can or will earn Recognition. For example, both sides empty (so the Tournament ties) and both players passing. The AI always summons and attacks when it can, so this needs a player who never acts.
  - **Why:** reported, not ruled on, as asked.
  - **Approval:** For Elliott to decide.

## 12. The demo deck and the AI

- **The deck:** one 40-card list, the same for both players (see `v4/README.md`, "The foundation deck").
  - **Why:** section 9.
  - **Approval:** **Needed** (the counts).
- **The AI:**
  - It is a greedy one-move AI like v2's and plays only through `applyAction`. It scores each legal move by its result.
  - It judges its own committed actions as if you let them happen.
  - It values a pending Strat as 70% resolved, PokéDollars and Bag Items by price, and active Objectives by their progress.
  - It never tries to play an Objective (UX1). It gets its Command modes, React included, from `commandModesFor`, the same helper as the hand display, and its React decisions are instant.
  - **Why:** section 16.
  - **Approval:** No.
