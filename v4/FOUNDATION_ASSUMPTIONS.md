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
| Dominating a placed Location at Supper | +1 Recognition per Location | Lowest non-zero value; several Locations can be dominated at once | **Needed** |
| Completing a Supporter Favour | +1 Recognition | Lowest non-zero value | **Needed** |
| Completing a Trainer Objective | +2 Recognition | Objectives take several turns, so worth a little more than a Favour | **Needed** |
| Specific card effects | No card gives Recognition directly; these Recognition sources are triggered by cards (Favours, Objectives, Commands that defeat a Pokémon) | No extra card design needed | **Needed** |
| Winning | 100 Recognition, at once, at any moment (also mid-action) | Spec; the only victory condition | No |
| Base Energy | v1: the Round number (max 10); Pass +1 except the Pass that ends the Battle Phase | Section 16 | No |
| Exert and Exhaust | v1 exactly: Exert maximum = Round (max 3); spent Exert is Exhausted for 2, 3 or 4 Rounds by position | Section 16 | No |
| Starting Energy | Round 1: Base Energy 1, Exert maximum 1 | Follows from v1's rule | No |
| PokéDollars per Round | +$1 at each Breakfast, including Round 1 | Spec "$1 per round" | No |
| PokéDollars per defeat | The defeated Pokémon's Energy cost at its Level, at least $1, to its opponent, whatever caused it; a Partner counts as cost 3 | Ties the reward to what the Pokémon was worth, using a number that already exists | **Needed** |

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
  9. The PokéMart refreshes 3 Items.
  10. Waiting Partners arrive.

  In Round 1, after the draw, each player may mulligan (v1).
- **Supper order:**
  1. Pending Strats resolve.
  2. Dominance: placed Locations, or the Tournament.
  3. Trainer Objective progress from dominance.
  4. Location durations count down and expired Locations are removed.
  5. "Until Supper" effects end.
  6. The hand is discarded, except Retained cards.
- **Why:** v1's order, with each new step placed where its effect is needed: the Tournament first, so old passives don't apply that Breakfast; heals before the draw; the PokéMart and Partners last.
- **Approval:** **Needed** (the order of the new steps).
- **Battle Phase:**
  - Initiative alternates each Round.
  - Players alternate one action per turn.
  - Two Passes in a row end the phase (v1).
  - **Approval:** No.

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
  - **The cost curve** is `cost = ceil((Level − 1) / 2)` for every series. A Mid Pokémon costs about half the Round's Base Energy.
- **Why:** one formula and one rule for all cards; the Discard Pile becomes the deck again, so it develops too.
- **Approval:** **Needed** (the cost curve).
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
    - Passing with unmatched Speed makes your fastest Pokémon Spent.
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
  - **Chosen:** three actions can be reacted to: an attack, a summon, and a Command played as Adapt.
    - When one is committed, its cost is paid at once (Energy, and the card leaves the hand).
    - A React window opens for the other player only if they can pay for a React that has a target.
    - They React with one card or let it happen.
  - **Why:** these are the actions section 4B's examples interrupt. The other actions (Pass, Retain, Place Location, Supporter, Strat, Items, Trainers) can't be reacted to.
  - **Approval:** **Needed**.
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
    - Pending Strats resolve in the order played.
    - It fizzles if its target Pokémon is gone, even if another Pokémon now stands in that space. The cost stays paid.
  - **Why:** "after the opponent's next turn" read literally.
  - **Approval:** **Needed**.
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
    - A sold PokéMart slot stays empty until the next Breakfast.
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
  - **Chosen:** one shared pool with one copy of each of the six Items. At each Breakfast (Round 1 included), unsold Items go back and 3 random Items go on sale.
  - **Why:** the spec.
  - **Approval:** No.
- **The six Items** (placeholder values): Potion, Charcoal and Choice Band are in the deck; the others are only in the PokéMart.

  | Item | Price | Type | Effect |
  |---|---|---|---|
  | Potion | $2 | Consumed | heal 3 |
  | Oran Berry | $1 | Consumed | heal 2 |
  | Choice Band | $2 | Consumed | +2 Attack until Supper |
  | Charcoal | $2 | Held | +1 Attack |
  | Mystic Water | $2 | Held | +2 Strength |
  | Leftovers | $3 | Held | heal 1 at each Breakfast |

  **Approval:** **Needed**.

## 10. Trainers and Partners

- **Trainer Objective:**
  - **Chosen:** a Battle Phase action costing 1 Energy. The Trainer goes to your Trainer area and only what happens afterwards counts. It stays until completed, with no limit on how many you have.
  - **On completion:**
    - The Partner arrives in your first (leftmost) empty space, Spent, like a summon.
    - Its On Summon resolves.
    - You gain the Objective's Recognition.
    - The Trainer goes to your Discard Pile.
  - **With no free space,** the Partner waits and arrives as soon as one frees (checked after every action and at Breakfast). A defeated Partner goes to the Released Pile.
  - **Why:** v2's Partners, simplified to one Objective.
  - **Approval:** **Needed** (the Objective cost, the leftmost space).
- **Trainer Command:**
  - **Chosen:** a separate Battle Phase action with its own Energy cost. It resolves at once and is then discarded. It can't be reacted to.
  - **Why:** the spec.
  - **Approval:** No.
- **The two Trainers** (placeholder values):

  | Trainer | Objective | Partner (On Summon) | Trainer Command |
  |---|---|---|---|
  | Misty | Defeat 2 enemy Pokémon | Starmie (draw 2) | 1 Energy: draw 2 |
  | Blaine | Dominate a Location at Supper (the Tournament counts) | Ninetales (1 damage to each enemy Pokémon) | 2 Energy: the same damage |

  **Approval:** **Needed**.

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
  - **Chosen:** at each Supper, more total current Strength across the battlefield earns +3 Recognition, which becomes 5 with the passive. Ties give nothing. It also counts as "dominating a Location" for Blaine's Objective.
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
  - It values a pending Strat as 70% resolved, PokéDollars and Bag Items by price, and Trainers by their progress.
  - **Why:** section 16.
  - **Approval:** No.
