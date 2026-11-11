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
  6. Breakfast heals: Lake of Rage, the Rain 2 bracket, Regenerate (G3: Leftovers is Regenerate 1).
  7. Cards off the battlefield take this Round's Level.
  8. Draw 7, less one per card Retained.
  9. Waiting Partners arrive.

  G1: the PokéMart no longer refreshes at Breakfast; its Item and Stock carry over between Rounds (section 9).

  In Round 1, after the draw, each player may mulligan (v1).
- **Match setup (UX1, Elliott's rule):** each player's deck (40 cards, gameplay update 5.4) is shuffled into the Draw Pile, Trainers included. For each Trainer card in the deck, an Objective tracker goes into that player's Trainer area, linked to the card. It is active from Round 1, costs nothing and starts at progress 0. Then comes Round 1's Breakfast.
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
- **The 10 lines (G2, gameplay update 4.2; approved by Elliott, 10 November 2026).** Stats are Attack / Strength at each Level of the series. Every form has one trigger; some have keywords.

  | Line (copies) | Type, attack, Speed, guard | Forms by Level | Stats by Level | Triggers and keywords |
  |---|---|---|---|---|
  | Ponyta → Rapidash (2) | Fire, Physical, Swift | Ponyta 1–3, Rapidash 4–6 | 2/2, 3/2, 3/3, 4/4, 5/4, 6/5 | Ponyta: On Defeated: draw 1 card. Rapidash: Quick Attack; On Knockout: +1 Attack (kept) |
  | Chinchou → Lanturn (2) | Electric, Special, Steady, Sp. Def guard | Chinchou 1–3, Lanturn 4–6 | 1/3, 2/3, 2/4, 3/5, 4/6, 4/7 | Chinchou: On Summon: +1 Energy this Round. Lanturn: On Attack: 1 damage to each enemy Pokémon in its Location |
  | Shinx → Luxio → Luxray (1) | Electric, Physical, Swift | Shinx 1–2, Luxio 3–4, Luxray 5–6 | 2/2, 2/3, 3/3, 4/4, 5/5, 6/5 | Shinx: On Summon: 1 damage to an enemy Pokémon. Luxio: Infiltrator; On Knockout: draw 1 card. Luxray: Infiltrator; On Summon: 2 damage to an enemy Pokémon |
  | Squirtle → Wartortle → Blastoise (2) | Water, Special, Steady, Def guard | Squirtle 2–3, Wartortle 4–5, Blastoise 6–7 | 2/4, 2/5, 3/6, 4/7, 5/8, 6/9 | Squirtle: On Summon: heal 2 to one of your Pokémon. Wartortle: Shell 1; On Summon: heal 2 to each of your Pokémon in its Location. Blastoise: Shell 1; On Attack: 2 damage to another enemy Pokémon in the target's Location |
  | Growlithe → Arcanine (2) | Fire, Physical, Swift | Growlithe 2–4, Arcanine 5–7 | 3/3, 3/4, 4/4, 5/5, 6/6, 7/7 | Growlithe: On Summon: your other Pokémon in its Location get +1 Attack until Supper. Arcanine: Overrun; On Knockout: draw 1 card |
  | Horsea → Seadra → Kingdra (1) | Water, Special, Steady (Kingdra Swift) | Horsea 2–3, Seadra 4–5, Kingdra 6–7 | 2/3, 3/3, 4/4, 5/5, 6/6, 7/7 | Horsea: On Summon: 1 damage to an enemy Pokémon. Seadra: Retaliate 1; On Summon: 1 damage to an enemy Pokémon. Kingdra: Infiltrator; On Summon: 2 damage to an enemy Pokémon |
  | Wooper → Quagsire (1) | Water, Physical, Slow, Def guard | Wooper 2–3, Quagsire 4–7 | 2/4, 2/5, 3/7, 4/8, 4/9, 5/10 | Wooper: Regenerate 1; On Summon: +1 Strength (kept) to another of your Pokémon in its Location. Quagsire: Regenerate 1, Rage; On Summon: heal 2 to each of your other Pokémon in its Location |
  | Magikarp → Gyarados (1) | Water, Physical, Steady | Magikarp 3–5, Gyarados 6–8 | 1/4, 1/5, 2/5, 7/8, 8/9, 9/10 | Magikarp: On Summon: draw 1 card. Gyarados: Rage; On Summon: 1 damage to each enemy Pokémon in its Location |
  | Charmander → Charmeleon → Charizard (2) | Fire, Special, Steady (Charizard Swift) | Charmander 3–4, Charmeleon 5–6, Charizard 7–8 | 2/4, 3/4, 4/6, 5/6, 7/8, 8/9 | Charmander: On Attack: +1 Attack (kept). Charmeleon: Rage; On Summon: 1 damage to an enemy Pokémon. Charizard: Overrun; On Summon: 2 damage to each enemy Pokémon |
  | Magby → Magmar → Magmortar (1) | Fire, Special, Steady | Magby 3–4, Magmar 5–6, Magmortar 7–8 | 2/3, 3/4, 4/5, 5/6, 7/7, 8/8 | Magby: On Defeated: 1 damage to each enemy Pokémon in its Location. Magmar: Retaliate 1; On Summon: 1 damage to an enemy Pokémon. Magmortar: On Attack: 1 damage to each other enemy Pokémon in the target's Location |

  Light: Ponyta, Chinchou, Shinx (Levels 1–6). Mid: Squirtle, Growlithe, Horsea, Wooper (2–7). Heavy: Magikarp, Charmander, Magby (3–8). Partners: Starmie (On Summon: draw 2 cards), Ninetales (On Summon: 2 damage to each enemy Pokémon).
  - **Approval:** No (Elliott, 10 November 2026); numbers are starting values for the simulation.
- **The deck (G3):** the final 40 cards of gameplay update 5.4 (G2's temporary 35-card deck is gone). Nothing depends on 40: the deck size is just the list's length.

## 4b. Triggers and keywords (G2, gameplay update 4.1)

- **Triggers** (one per form, as data; resolved by the engine):
  - **On Summon:** when it arrives (a summon or a Partner).
  - **On Attack:** after it attacks (a Pokémon or the Player Character), if it survived.
  - **On Defend:** when it survives an attack that damaged it (attacks only, not Command or trigger damage).
  - **On Defeated:** when it's defeated, by anything; its effects use the lane it stood in.
  - **On Knockout:** when its attack, or its hit-back, defeats an enemy Pokémon, if it's still in play (as v2). A defeat by Retaliate alone isn't its hit-back.
  - **On Breakfast:** at each Breakfast while it's in play (after Breakfast's heals and draw, the initiative player's first).
- **Effects:** draw; +N Energy this Round (added to Base Energy, so it lasts the rest of the Round); damage to a chosen enemy Pokémon (On Summon only), to each enemy Pokémon, to each in its Location, or in the target's Location (each, each other, or "another": the weakest other one there, then the lowest lane); heal one of your Pokémon (chosen), each in its Location (optionally not itself), or itself; +N Attack until Supper to your other Pokémon in its Location; +N Attack or Strength (kept) to itself or to a chosen other Pokémon of yours in its Location.
  - **In its Location:** a placed Location's lanes; all 9 in the Tournament; otherwise just its own lane.
  - **The target's Location** for an attack on the Player Character: there is none, so that effect does nothing.
  - **Chosen targets:** the summoner picks with the targeting arrow and its preview (the AI through its normal choice). The summon can't be cancelled; until the target is chosen, choosing is the only legal action. With no legal target that part fizzles, with a log line.
- **Resolution order:** triggers resolve after the action that caused them, never in the middle of it, in a queue: by chain depth, then (1) the acting Pokémon's (the attacker's On Attack, then its On Knockout; an On Summon), (2) the other Pokémon's (the defender's On Defend, or On Knockout from its hit-back), (3) On Defeated, each in the order queued. A React's own triggers resolve right after the React, before the action it answered. Triggers left over resolve before the turn passes.
- **Chains:** a trigger's effects can set off more triggers (a damage trigger defeating something fires On Defeated); those go one level deeper. A chain stops after 4 levels (MAX_CHAIN), with a log line.
- **React:** triggers aren't Command Cards: they can't be Reacted to.
- **Keywords** (from the card, and from a Held Item; numbers add up):
  - **Quick Attack:** arrives Active instead of Spent.
  - **Infiltrator:** its attacks ignore guards: every enemy Pokémon and the enemy Player Character are legal targets.
  - **Overrun:** when its attack defeats an enemy Pokémon, the damage left over (after Shell) goes to the enemy Player Character as Recognition for you, 1 per damage (×1.5 in the Tournament, like any Recognition).
  - **Shell X:** each instance of damage it takes is X less, minimum 1: attacks, hit-backs, Retaliate, Commands, triggers and Trainer Commands.
  - **Regenerate X:** heals X at Breakfast, with Breakfast's other heals.
  - **Retaliate X:** when an attack damages it, the attacker takes X (the attacker's Shell reduces it). Not for its own hit-back.
  - **Rage:** +1 Attack for good each time it survives damage (any damage).
- **Why:** v2's settled wording and its implementation (v2/src/engine/game.js), in v4's terms.
- **Approval:** No for the rules (Elliott, 4.1). **Needed:** the resolution order; "another enemy Pokémon" picking the weakest; +N Energy lasting the Round; On Knockout needing its Pokémon still in play.

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
  - **Chosen:** Flame Charge's React, Flannery and X Attack (an Item since G3) last until that Round's Supper. So an until-Supper effect from a Strat that resolves at Supper has no effect.
  - **Why:** one simple end point.
  - **Approval:** **Needed**.
- **The nine Commands (G3, gameplay update 5.1, one copy each):** each mode has its own cost and target.

  | Card | Target | React | Adapt | Strat |
  |---|---|---|---|---|
  | Ember | an enemy Pokémon | 1: 2 damage | 2: 3 damage | 3: 5 damage |
  | Thunderbolt | an enemy Pokémon | 2: 2 damage | 3: 4 damage | 4: 6 damage |
  | Rock Slide | a Location | 2: 1 damage to one enemy | 3: 1 damage to each enemy there | 4: 2 damage to each enemy there |
  | Heat Wave | all enemies | 2: 1 damage to the attacker | 3: 1 damage to each enemy Pokémon | 5: 2 damage to each enemy Pokémon |
  | Surf | a Location | 1: heal 2 to the Pokémon being attacked | 3: 2 damage to each enemy there | 4: 3 damage to each enemy there |
  | Bubble Beam | an enemy Pokémon | 1: the attacker becomes Spent after its attack | 2: 2 damage, and it becomes Spent | 3: 3 damage, and it becomes Spent |
  | Recover | one of your Pokémon | 1: heal 2 | 2: heal 4 | 3: heal 8 |
  | Flame Charge | one of your Pokémon | 1: +1 Attack until Supper | 2: +1 Attack (kept) | 3: +2 Attack (kept) |
  | Dive | one of your Pokémon | 1: return the attacked Pokémon to your hand (the attack fizzles) | 1: return it to your hand | 2: return it to your hand and draw 1 card |

  - **A Location target (Rock Slide, Surf):** you choose a lane on the enemy side. If a Location covers it, every enemy Pokémon in that Location is hit; in a lane with no Location, just that lane's; in the Tournament, every enemy Pokémon. A lane is a target only if that area holds an enemy Pokémon. **Settled here:** the lane is picked on the enemy row (a Location covers both rows, so this is the same Location). **Needed**.
  - **All enemies (Heat Wave):** no choice; a Strat of it resolves on whatever enemies are there then (it never fizzles while one is).
  - **React targets:** a React mode that names "the attacker" or "the Pokémon being attacked" (Heat Wave, Surf, Bubble Beam, Dive) is offered only against an attack by a Pokémon on a Pokémon, not against an Adapt or a resolving Strat. The other React modes (Ember, Thunderbolt, Rock Slide, Recover, Flame Charge) work in every React window as before. **Settled here**, from the table's wording. **Needed**.
  - **"Becomes Spent" (Bubble Beam):** the target is Spent at once (it can't attack or hit back this Round). Its React makes the attacker Spent, but an attacker is always Spent after attacking, so **the React has no effect in v4** (reported in `docs/balance-g3.md` with a suggestion). **For Elliott to decide**.
  - **Kept (Flame Charge):** the Attack stays for the rest of the match while the Pokémon is in play (like Brock's Strength); Dive loses it.
  - **Dive:** the Pokémon's card goes back to its owner's hand (the same card); it develops with the Rounds again (this Round's Level); its Held Item goes back to the PokéMart's pool; damage and anything kept are lost. A Partner can't Dive (it isn't a deck card). Dive's React fizzles the attack (the attacker is still Spent; no defeat, no Recognition). **Needed** (Partners).
  - React windows: the options are counted with the window in place, so a React whose only target is the attacker or the attacked Pokémon opens a window.

  **Approval:** No for the values (Elliott, 10 November 2026); **Needed** for the "settled here" points.

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
  | Flannery (G3) | 1 | each of your Pokémon +1 Attack until Supper | a Fire Pokémon | +2 |
  | Pokémon Breeder (G3) | 1 | a Pokémon card from your Discard Pile into your hand | an Item | 2 Pokémon cards |

  - **G3 (gameplay update 5.2):** one copy each (one Professor Oak). A Favour gives the enhanced effect and **+3 Recognition**.
  - **Pokémon Breeder's choice:** the player picks the cards in the Release dialog (a small Discard picker under the Release cards, 1 or 2 by the Favour); the AI picks the highest-Level Pokémon cards. A recovered card takes this Round's Level. With fewer Pokémon cards in the Discard Pile than allowed, it takes them all (none: nothing happens). Released cards go to the Released Pile, not the Discard Pile, so they can't be taken back by the same play. **Settled here**. **Needed**.

## 9. Items, the PokéMart and the Inventory Bag

- **Purchase Item:**
  - **Chosen:** a Battle Phase action. You buy one Item from your hand or the PokéMart, then use it now (with a target) or store it in your Bag (6 spaces, v1).
    - There's no In Delivery wait: a stored Item can be used from your next turn.
    - G1: the PokéMart's Item, once bought, shows Sold out until the buyer has finished their next turn (section below).
    - An unbought Item in hand is discarded at Supper.
  - **Why:** v1's buying without its extra delay step.
  - **Approval:** **Needed** (no In Delivery).
- **Held and Consumed:**
  - **Chosen:** every Item targets one of your Pokémon in play, except Amulet Coin (G3), which has no target: buying it to use resolves at once.
    - **Held:** one per Pokémon; lost when that Pokémon is defeated.
    - **Consumed:** resolves, then leaves play.
    - Used and lost Items go to the PokéMart's pool, including deck copies (as in v1), so the pool can hold duplicates.
  - **Why:** v1's rule.
  - **Approval:** **Needed** (one Held Item each).
- **The PokéMart:**
  - **Chosen (G1, gameplay update 2.6):** one shared pool with one copy of each Item (ten since G3), and **one Item on sale**, always on show in the right-hand column with its **Stock** (turns on sale):
    - Each turn taken by either player in the Battle Phase uses 1 Stock (React decisions and resolving Strats aren't turns; the Pass that ends the Battle Phase is). At 0 the Item goes back to the pool and a random Item from the pool replaces it, with full Stock.
    - Stock carries over between Rounds; there's no refresh at Breakfast.
    - When it's bought, the PokéMart shows **Sold out** until the buyer has finished their next turn (the turn of the purchase doesn't count); then a random Item arrives with full Stock. Nothing counts down while it's Sold out.
    - Match setup puts the first random Item on sale.
  - **Why:** Elliott's rule (Q3, 10 November 2026).
  - **Approval:** No.
  - **Settled here (not in the update):** the replacement Item is chosen from the pool without the one that just ran out, when the pool has another, so the Item on show always changes. **Needed**.
- **The Items (G3, gameplay update 5.3):** Potion, Oran Berry, X Attack, Charcoal and Quick Claw are in the deck (one copy each); the PokéMart's pool has one copy of every Item. Stock by price: $1 → 8, $2 → 6, $3 → 4, $4 → 3.

  | Item | Price | Stock | Type | Effect |
  |---|---|---|---|---|
  | Oran Berry | $1 | 8 | Consumed | heal 2 |
  | Potion | $2 | 6 | Consumed | heal 4 |
  | X Attack | $2 | 6 | Consumed | +2 Attack until Supper (was a Command) |
  | Charcoal | $2 | 6 | Held | +1 Attack |
  | Mystic Water | $2 | 6 | Held | +2 Strength |
  | Quick Claw | $3 | 4 | Held | Speed one step higher (Slow → Steady → Swift; Swift stays Swift) |
  | Rocky Helmet | $3 | 4 | Held | Retaliate 2 |
  | Leftovers | $3 | 4 | Held | Regenerate 1 |
  | Choice Band | $4 | 3 | Held | +3 Attack, but the holder can't hit back |
  | Amulet Coin | $4 | 3 | Consumed | gain 3 Recognition (no target) |

  - **Quick Claw:** every Speed check uses the higher Speed: who is Ready, the Pass rule's unmatched Speed, and the card's Speed shown on the board.
  - **Rocky Helmet:** its Retaliate adds to a printed Retaliate (Seadra: 1 + 2 = 3), like any keyword number.
  - **Choice Band:** the holder is still Ready (it can attack and blocks a Pass as usual) but never hits back when attacked.
  - **Amulet Coin:** its Recognition counts as "other" in the balance report (not one of section 6's five sources).

  **Approval:** No (Elliott, 10 November 2026).

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

- **The deck:** one list, the same for both players (see `v4/README.md`): G3's final 40 cards (gameplay update 5.4).
  - **Why:** section 9.
  - **Approval:** **Needed** (the counts).
- **The AI:**
  - It is a greedy one-move AI like v2's and plays only through `applyAction`. It scores each legal move by its result.
  - It judges its own committed actions as if you let them happen.
  - It values a pending Strat as 70% resolved, PokéDollars and Bag Items by price, and active Objectives by their progress.
  - G2: it reads triggers and keywords through the results it scores (Retaliate defeating its attacker, Shell, Overrun's Recognition), adds a little value for keywords on the board (Infiltrator's reach most), and picks an On Summon target by trying each one.
  - G3: it plays each Command mode on its own targets (a lane for Rock Slide and Surf, all enemies for Heat Wave, the attacker or the attacked Pokémon as a React). Dive as a React is judged like any move: it saves a Pokémon from a lethal attack when that is worth more than the card on the board. Pokémon Breeder takes back its highest-Level Pokémon cards. PokéMart Items are valued by their result (Amulet Coin's Recognition counts at once).
  - It never tries to play an Objective (UX1). It gets its Command modes, React included, from `commandModesFor`, the same helper as the hand display, and its React decisions are instant.
  - **Why:** section 16.
  - **Approval:** No.

## 13. Card design (C1)

- **Chosen** (`docs/v4-card-overhaul.md` sections 1, 2 and 6, approved by Elliott on 10 November 2026; the mockup `docs/design/v4-cards-mockup.jpg` and its source):
  - **One renderer**, `src/ui/card.js`: every card is drawn at 340×476 (an SVG frame, HTML text in fixed zones) and scaled. `cardHTML(card, { size, state })` returns the markup; `renderCard` the element.
  - **Sizes:** Full 340 (hover zoom, the React window, the mode picker, the Release choice, the Discard and Released viewers); Mini 200 (the hand, the PokéMart card, the mulligan, Pokémon Breeder's Discard picker); Token **164** (a Pokémon on the board); Chip 24–40 px (trackers, the Bag, the log).
  - **The token size:** 164, not 170. The stage is a fixed 1920×1080 (scaled to the window), so 1366×768 and 1280×720 change nothing here; but the board's nine lanes are 172.4 px apart, so 170-px tokens would sit 2 px apart and their glows would touch. 164 leaves 8 px. **Needed**.
  - **Frames**, one trait each: Pokémon chamfered top corners; Command a notch that seats the cost; Supporter a low arch; Item an eyelet; Trainer a central peak; Location scroll rolls. A dark edge, a brass hairline, an inner rule 7 px in; colour only on the type line, the crest and the diamond on the panel rule.
  - **Text zones** (in the 340×476 drawing): the name (one line; a long name takes one tighter letter-spacing step, never a smaller font), the type line, the rules (14.5 px), the mode rows, the Favour box, the Stock line, the chips. The cost well, the crest and the two stat tabs are fixed. The panel rule sits at 296 (Pokémon, Item), 262 (Command), 270 (Supporter), 290 (Trainer), 300 (Location); 340 / 326 / 376 on Mini cards; 330 on tokens.
  - **The art** fills the frame (cover), framed by `artFocus(cardId)`: 50% across, 35% down for every piece in C1; C2 adds a focal point per piece.
  - **What each size shows:** Full: everything (Command rows: React, Adapt, Strat, the modes not allowed now dimmed; a Target line). Mini: art, cost, name, stat tabs, Level and Speed, and one tag (the first trigger; a Command's playable modes as chips; for the other kinds, their Release, Item kind, "Trainer" or lanes and Rounds). Token: art, a keyword chip, the Held Item inset, the name, the stat tabs, Level and Speed; pending Strats as chips.
  - **States:** playable (a gold edge glow) / unplayable (dimmed; its reason as a line under the hovered card), Ready (a pulsing gold glow), Spent (grey, tilted), damaged (a red Strength number), selected, legal target, illegal target (dimmed, the reason under it), Retained (a chip), Sold out (a stamp). The cost number turns red when you can't afford it.
  - **Partners** show ★ in place of their Level and have no cost well (they arrive free).
  - **Hover replaces tooltips:** a hand card lifts and its Full card shows above the hand; a board token's Full card shows beside it on the side with room; the PokéMart card's to its left; a chip's (Bag, trackers) beside it. The zoom never takes the pointer.
  - **New viewers:** the Discard and Released Piles (yours and the Opponent's) open by clicking the pile or the "Released N" line: every card at Full size, newest first.
  - **Not in the mockup, designed in its style:** the Grass crest (Recover); a Command's Target line under its rows; Mini tags for Supporters, Items, Trainers and Locations; the token's Strat chips; the Sold out stamp; Pokémon Breeder's Discard picker and the mulligan as Mini cards; the right column repacked (a shorter Energy tile, the PokéMart's Mini card with its Stock and Buy beside it, a one-line log ticker).
  - **The test:** `node v4/tests/cardtext.test.js` renders every card at every size in Chromium (every Pokémon line at every Level, with and without a Held Item and a keyword; Partners; every Command in five mode states; Supporters, Items with and without Stock, Trainers at three points, Locations) and fails on any text that overflows its box, spills out of its zone or the frame, overlaps another text, a stat tab, the cost well, the crest or an inset, or renders under 10 px at its size.
- **Approval:** No for the design (Elliott); **Needed** for the token size and the additions above.
- **C2 (`docs/v4-card-overhaul.md` 2.3–2.5 and 3):**
  - **No text is ever cut:** every piece of text is shown in full or not at all. No `text-overflow: ellipsis` and no "…" trimming remain anywhere in v4's interface.
  - **The hand's visible strips:** the fan spreads across all the hand's room (up to an 8-px gap) before cards overlap. A covered card shows only a strip at its left; its name and tag (or mode chips) sit left-aligned inside that strip, with the cost well above them. After drawing, any text that would reach under the card on top of it is hidden (each mode chip on its own); hovering still shows the Full card. `cardtext.test.js` renders hands of 5, 7, 9 and 11 cards and fails if any visible text is partly covered.
  - **The Weather chip:** one whole line per Weather in play (its chip and its strongest active effect); the next bracket only when a line is free.
  - **The log ticker:** one entry on up to two lines, in a short form written for it ("Gyarados hit Charizard for 6", "Magmortar: On Attack, 1 damage to each other enemy Pokémon in the target's Location"; whose it is shows in its colour). If even that doesn't fit, whole clauses are dropped from the end, never words. The full sentence stays in the log drawer.
  - **Recover** is a Normal move: the Normal crest and the sandstone accent.
  - **Focal points:** `assets/cards/focus.json` has an entry for each of the 57 pieces of art the game uses and the card back: `x`, `y` (the subject's centre, % of the image), `face` (a chip's centre), `zoom` (a chip's zoom; default 1.6), `tile` (a Location's wide crop on the board) and the image's `w`, `h`. **Settled here:** the art is about 5:7, the card's own shape, so Full, Mini and Token show the whole picture (nothing is cropped there; no token zoom is used). The focal points matter for chips (centred on the face, at their zoom, never showing past the image's edge) and Location tiles (the landmark kept in view across 2, 3 or 4 lanes). **Needed**.
  - **The review tool:** `node v4/tools/artframe.mjs <dir>` renders every piece at Full, Mini, Token and chip sizes (and each Location's tiles) onto one contact sheet per card type.
  - **The holo finish:** a soft holo on the Full and Mini sizes of each line's final form (Rapidash, Lanturn, Luxray, Blastoise, Arcanine, Kingdra, Quagsire, Gyarados, Charizard, Magmortar); a richer one (the same band plus a slow gold, rose and teal drift) on Partners and Trainers at Full, Mini and Token size (not on chips). It's a fine diagonal band that follows the pointer, clipped to the frame and faded out above the text panel, so it never touches the text.
  - **Tilt:** every Full card tilts under the pointer, at most 6°, its sheen moving against the tilt. The hover zoom's Full card follows the pointer over the card it shows.
  - **Low motion:** no tilt, no moving sheen, no drift; a still sheen stays.
  - **Not in the prompt, settled here:** a React card that needs a target hides the React window's cards and banner while you choose (the prompt bar says what to do), so every target on the board can be clicked. An Item with no target (Amulet Coin) can be finished with a click anywhere on the board (as well as a drop or Enter). **Needed**.

## 14. The Codex (C3)

- **Chosen** (`docs/v4-card-overhaul.md` 4; `docs/v4-ux-plan.md` 10, part A; the C3 prompt):
  - **Opening it:** right-click anything when no choice is in progress (with a choice in progress, right-click still cancels it, as in UX3); C on whatever is under the pointer, at any time; the ⓘ on a Full card. Esc or ✕ closes it.
  - **Where it sits:** x 1052–1904, y 76–770 on the 1920×1080 stage: over the right-hand column and the board's right-hand lanes. Your hand and the board's centre stay visible. The match carries on underneath; the open entry follows it, and says "no longer in play" if its subject leaves.
  - **Card first:** the Full card at 340 px, with its holo and tilt, on the left (a header for things that aren't cards). On the right, in order:
    1. what it does now (its full wording and its current state);
    2. where its numbers come from;
    3. keywords and triggers, each with its glossary meaning;
    4. for a Pokémon, its forms by Level as small Mini cards (the current one marked) and, off the battlefield, its Level growth and what it becomes next Round, with ▲/▼.
  - **Links:** every game term in every line links to its glossary entry, with Back and breadcrumbs. The prompt bar, the log drawer and the ? overlay's Rules page link their terms too; a click opens the Codex.
  - **The sums** come from the engine's own functions (`attackParts`, the Location, Weather and Held bonuses, `damageOf`, `effectiveSpeed`, the cost curve), so they always equal what the card shows. Examples: "Attack 11 = 8 base + 1 kept + 1 Mt. Ember + 1 Charcoal"; "Strength 6 = 9 base − 3 damage (of 9)"; "Damage 5 = 4 Attack + 1 Sun 2, Physical".
  - **What can be inspected:**
    - **any card you can see:** your hand, the board, the PokéMart, both Bags, both Discard and Released Piles, Strats, the React window, the mode picker, the Release choice and the log;
    - Locations, the Tournament, Objective trackers (the Partner's Full card), both Recognition rings (history by source with the Round of each), both Energy readouts, the Weather chip (the full bracket table), the PokéMart (Stock, Sold out, restocking), the piles, log lines, glossary terms and Rules.
    - Never the Opponent's hand, nor the order of either Draw Pile: the Deck is a count only.
  - **Engine records (data only, no rule change):**
    - each player's Recognition history (`recHistory`: Round, amount, base, source, kind);
    - this Round's Energy sources (`energyRound`: the Round's Base Energy, Passes, effects such as Chinchou's).
  - **The React countdown waits while the Codex is open.** On your own turn the AI never acts, so nothing else needs to wait. The AI's own turn carries on underneath.
  - **The glossary** (`src/engine/glossary.js`, 93 terms) is written only from this file, `docs/v4-foundation-spec.md`, `docs/v4-gameplay-update.md` and the engine. Never the series names.
    - **Case:** a term written in lower case (turn, guard, summoned) links in either case. One written with a capital (Attack, Level, Spent) links only with its capital, so plain words ("an attack") stay plain.
    - **Card names are never split into terms:** Lake of Rage isn't Rage.
  - **The Rules page:** the ? overlay has Keys and Rules tabs. Rules is the whole glossary by topic, searchable, every term a link into the Codex. The Codex has the same search in its header.
  - **`?fps`:** a small frame-time readout in the bottom-left corner (fps, mean, 95th percentile and worst frame over the last 120 frames).
- **Not as the prompt read, and why:**
  - **The hover zoom's ⓘ is a hint ("ⓘ C"), not a button.** The zoom never takes the pointer (C1), so moving to it would land on whatever lies between. The clickable ⓘ is on Full cards you can reach: the React window, the mode picker, the pile viewers and the Release choice.
  - **The mode picker:** it is a choice in progress, so right-click cancels it. C and its ⓘ inspect its card.
  - **Cards in the hand and on the board aren't links themselves:** a click plays or selects them. Their full wording, with every term linked, is in the Codex beside their Full card.
  - **Previews follow the pointer and can't take a click.** C on the thing under the pointer opens it.
  - **The log ticker is a button** (it opens the log), so its terms link in the log drawer.
- **Approval:** **Needed** for:
  - the panel's position;
  - the Opponent's sealed Strat being inspectable (the board's own label already names it);
  - the link case rule.
