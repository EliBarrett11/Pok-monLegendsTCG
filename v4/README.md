# Pokémon Legends v4: the foundation

v4 builds `docs/v4-foundation-spec.md`: sections 1–16, with section 16's clarifications taking priority. It's built in five steps. v1 (the root), v2 (`v2/`) and v3 (`v3/`) don't change.

- **Play v4:** https://elibarrett11.github.io/Pok-monLegendsTCG/v4/
- **Assumptions:** `v4/FOUNDATION_ASSUMPTIONS.md`.

## How it's built

Plain HTML, CSS and JavaScript modules: no build step and relative paths only. It shares only the art in `assets/cards/`.

| Folder | Contents |
|---|---|
| `v4/src/rules.js` | The numbers |
| `v4/src/engine/` | Game rules and state (`game.js`), cards (`cards.js`), Energy (`energy.js`), random numbers. **No DOM code.** |
| `v4/src/ai/` | The simple AI: greedy, one move ahead, through the engine's actions |
| `v4/src/ui/` | The interface (v3's look), coded icons |
| `v4/tests/` | `node v4/tests/core.test.js`, `locations.test.js`, `commands.test.js`, `items.test.js`, `tournament.test.js`, `ux1.test.js`, `ux2.test.js` and `ux3.test.js` (focused rule tests; no match simulations) |
| `v4/tools/` | `node v4/tools/layout.mjs` (the nothing-clipped check); `node v4/tools/stamp.mjs` (cache-busting: run before each commit) |

**Reused (copied, with the source noted in each file):**

| From | What | Changed? |
|---|---|---|
| v1 | `src/engine/energy.js` (Base Energy, Exert and Exhaust) | Unchanged |
| v1 | `src/engine/random.js` | Unchanged |
| v3 | `v3/src/ui/style.css` and `icons.js` | Renamed `v3-` → `v4-` |
| v3 | `v3/src/main.js` | Adapted |
| v3 | `v3/src/ai/ai.js` | Adapted |
| v3 | `v3/tools/layout.mjs` and `stamp.mjs` | Adapted |
| v2 | `v2/src/engine/game.js`: `locationStarts` (where a Location fits) and `syncPassives` (keeping stat bonuses in step), now `locationStarts` and `syncBonuses` in `v4/src/engine/game.js` | Adapted (F2) |
| v2 | `v2/src/engine/game.js`: `playSupporter`, `supporterPlayable` and `favourMet`; `v2/src/engine/cardtypes.js`: `FAVOURS` (three conditions) and the Supporter shape | Adapted (F3): no targets, no Trainer Points; the Favour gives Recognition |
| v1 | `src/engine/game.js`: Open Bag's buy-from-hand and buy-from-PokéMart, `BAG_SIZE` (6), Consumed Items going to the PokéMart | Adapted (F4): a separate Purchase Item action; no In Delivery wait |
| v2 | `v2/src/engine/game.js`: `unlockTier` / `partnerInto` and the waiting-Partner list; printed Partner cards | Adapted (F4): Partners come from Trainer Objectives |

The rules for Ready, the unmatched-Speed Pass and trades follow v3's engine.

**URL options:** `?seed=123` replays the same match; `?autoplay` lets the AI play both sides; `?debug` exposes `window.__v4` for checks.

## The foundation deck (40 cards, the same list for both players)

One simple, neutral deck that shows every approved feature (spec section 9). Card data lives in `v4/src/engine/cards.js` (`DEMO_DECK`).

| Card | Type | Count | What it demonstrates |
|---|---|---|---|
| Ponyta → Rapidash | Pokémon, Light (L1–6) | 4 | Light development, Swift Speed, Physical attacks |
| Chinchou → Lanturn | Pokémon, Light (L1–6) | 3 | a Special Defence guard |
| Squirtle → Wartortle → Blastoise | Pokémon, Mid (L2–7) | 4 | Mid development, three evolution Levels, a Defence guard |
| Growlithe → Arcanine | Pokémon, Mid (L2–7) | 4 | Mid development, Physical attacker |
| Magikarp → Gyarados | Pokémon, Heavy (L3–8) | 3 | Heavy development, an On Summon ability (draw 1, Levels 3–5) |
| Charmander → Charmeleon → Charizard | Pokémon, Heavy (L3–8) | 2 | three evolution Levels, an On Summon ability at Level 7+ |
| Cerulean Cape | Location (2 lanes, 3 Rounds) | 1 | +1 Strength passive, Rain |
| Mt. Ember | Location (3 lanes, 3 Rounds) | 1 | +1 Attack passive, Sun |
| Lake of Rage | Location (2 lanes, 2 Rounds) | 1 | heal at Breakfast, Sun |
| Route 119 | Location (4 lanes, 2 Rounds) | 1 | summoning discount, Rain |
| Ember | Command | 2 | Adapt, React and Strat: damage |
| Recover | Command | 2 | Adapt, React and Strat: healing |
| X Attack | Command | 1 | Adapt, React and Strat: a temporary stat boost |
| Rock Slide | Command | 1 | Adapt, React and Strat: a battlefield effect (a whole Location) |
| Nurse Joy | Supporter (Release 1) | 1 | healing; Favour: a Water Pokémon |
| Professor Oak | Supporter (Release 1) | 2 | searching for a Pokémon; Favour: a Location |
| Brock | Supporter (Release 2) | 1 | a battlefield benefit (+Strength); Favour: a Pokémon of Level 4+ |
| Potion | Item, Consumed, $2 | 2 | an Item from the deck; use now or store |
| Charcoal | Item, Held, $2 | 1 | a Held Item |
| Choice Band | Item, Consumed, $2 | 1 | a temporary stat boost |
| Misty | Trainer | 1 | Objective "Defeat 8 enemy Pokémon" → Starmie (Level 8); Trainer Command: draw 2 |
| Blaine | Trainer | 1 | Objective "Dominate a Location 5 times" → Ninetales (Level 8); Trainer Command: 1 damage to each enemy Pokémon |

**In total:** 20 Pokémon, 4 Locations, 6 Command Cards, 4 Supporters, 4 Items and 2 Trainers.

The PokéMart has its own pool of one each of the six Items: Potion, Oran Berry, Choice Band, Charcoal, Mystic Water and Leftovers. So Oran Berry, Mystic Water and Leftovers can only be bought there.

## Validation (spec sections 12 and 14)

No match simulations or AI-vs-AI matches were run. Each item was checked by a focused test (`node v4/tests/<name>.test.js`) or in the browser:

- **Browser check:** a real match in Chromium against the AI, with the human side keeping its hand, passing and letting each React window resolve. It ran start to finish with no errors: the Tournament began at Round 7 (70+ Recognition), its banner showed, and the AI won at 102 Recognition.
- **Click-through checks:** each feature's player flows (F3 and F4), and a player win at 100 by clicking an attack in the Tournament.
- **Layout check:** `node v4/tools/layout.mjs` checks every screen at 1920×1080, 1366×768 and 1280×720.

| Requirement | How it was verified |
|---|---|
| The project builds and runs without errors | No build step. Every test imports the modules. The layout check loads every scenario at three sizes with no page errors. Two browser checks (the full match and the player win) had no errors. |
| A match can be started; both players get the same deck | `core.test.js` and `tournament.test.js` compare both piles with the 40-card list. |
| Both players can perform the available actions; all nine Battle Phase actions work | Each action is applied through `applyAction` for the player and the AI:<br>- Summon: `core`<br>- Command (Adapt, React, Strat): `commands`<br>- Supporter: `commands`<br>- Place Location: `locations`<br>- Purchase Item: `items`<br>- Play Inventory Item: `items`<br>- Trainer Command: `items`<br>- Retain: `core`<br>- Pass: `core`<br>Attack and Trainer Objective also work.<br>Browser click-throughs covered each player flow. |
| Every approved card type works | Pokémon (`core`), Command (`commands`), Location (`locations`), Supporter (`commands`), Item and Trainer (`items`). |
| Pokémon development works | `core`: Levels by Round and series, the cost curve, snapshots on summon. |
| Energy and PokéDollar economies work | `core`: Base Energy, Pass, Exert and Exhaust. `items`: income, defeat rewards, spending. |
| Command React, Adapt and Strat work; React interrupts; Strat is delayed | `commands`:<br>- React resolves before an attack, a summon or an Adapt, can make it fizzle, uses no turn and can't be reacted to.<br>- Strat resolves after the opponent's next turn, or at Supper, and fizzles when its target is gone. |
| Supporter Release and Favour work | `commands`: Release is permanent and never reshuffled, the Supporter is Released too, and the Favour gives its effect and Recognition. |
| Locations can be placed and dominated; Weather works | `locations`: placement, durations, passives, all four brackets, dominance, ties. |
| Items, the PokéMart (3 a Round) and the Inventory work | `items`: buying from hand and the PokéMart, use now or store, the Bag limit, playing from the Bag, Held and Consumed, and the refresh of 3 each Breakfast with Items returning to the pool. |
| Trainer Objectives and Commands work | `items`: progress, completion, the Partner (including waiting for a space), its On Summon, the Recognition, both Trainer Commands. |
| Recognition from every approved source | Damage to the Player Character and defeats: `core`. Dominance: `locations`, `tournament`. Favours: `commands`. Trainer Objectives: `items`. Card effects (a Command or Partner On Summon that defeats): `commands`, `items`. |
| The Tournament replaces the active Locations and functions | `tournament`:<br>- it triggers at Round 10 or 70+ Recognition;<br>- Locations are removed to the Discard Piles and Pokémon stay;<br>- passives and Weather end;<br>- Locations can't be placed;<br>- Recognition is +50%, rounded up;<br>- dominance gives +3 (5), ties give nothing.<br>The browser match also triggered it. |
| A player can win at 100 Recognition | `core` and `tournament`, including during the Tournament for either player. The browser checks ended a match both ways. |
| A complete match is playable with the same deck | The browser match above, start to finish. |
| Important assumptions are documented | `v4/FOUNDATION_ASSUMPTIONS.md`, in the section 13 format. |

## Build log

- **F1 — the core (step 1 of 5).**
  - **The battlefield:**
    - 9 lanes, with one space per player in each.
    - The whole battlefield is the Default Location (placed Locations come later), with no passive, Weather or dominance.
    - The Player Characters sit outside it.
  - **Rounds:**
    - **Breakfast:** Exhaust recovers; Base Energy is the Round (max 10); Exert maximum is the Round (max 3); Spent Pokémon become Active; Pokémon cards off the battlefield gain their Level; draw 7, less one per Retained card.
    - **Round 1:** draw 7, then a v1 mulligan.
    - **Battle:** alternating turns, with one action each:
      - Summon;
      - Attack (a Ready Pokémon attacks an enemy Pokémon or the enemy Player Character, subject to guards);
      - Retain (1 Energy);
      - Pass (+1 Base Energy, except the Pass that ends the phase; the unmatched-Speed rule applies).
    - **Supper:** the hand is discarded except Retained cards. The Discard Pile reshuffles into the Draw Pile when it runs out (v1).
  - **Energy:** v1's Base Energy, Exert and Exhaust exactly (recovery positions 2, 3 and 4 Rounds later).
  - **Pokémon:**
    - Light (Levels 1–6), Mid (2–7) and Heavy (3–8) series, +1 Level per Round off the battlefield.
    - A summoned Pokémon is a snapshot.
    - Form, stats, ability and cost come from the Level; Mid costs about half the Round's Base Energy.
    - **Evolution paths:** Ponyta → Rapidash, Chinchou → Lanturn, Squirtle → Wartortle → Blastoise, Growlithe → Arcanine, Magikarp → Gyarados, Charmander → Charmeleon → Charizard.
  - **Speed and combat:**
    - Ready and Spent work as in v3.
    - **Guards (section 16):** a Defence or Special Defence guard protects its side's other Pokémon in the same Location, and its Player Character against attackers in its Location.
  - **Recognition:** 1 per damage to the enemy Player Character and +2 per Pokémon defeated; 100 wins.
  - **The AI:** greedy, one move ahead, through the same engine actions.
  - **The interface:**
    - Both Recognition totals with progress to 100.
    - Base Energy, available Exert with its maximum, and each Exhaust point's recovery Round.
    - Hand, Deck, Discard and Released counts for both players.
    - Board Pokémon show their Level, art, Attack, Speed icon and Strength, with full details on hover.
    - An Actions panel shows each action as available or why not.
    - Unplayable hand cards say why on hover.
    - Retain: select a card, then click Retain.
  - **The demo deck so far:** 20 Pokémon cards, the same for both players:

    | Series | Pokémon | Copies | Guard |
    |---|---|---|---|
    | Light | Ponyta | 4 | — |
    | Light | Chinchou | 3 | Special Defence |
    | Mid | Squirtle | 4 | Defence |
    | Mid | Growlithe | 4 | — |
    | Heavy | Magikarp | 3 | — |
    | Heavy | Charmander | 2 | — |

  - **Checks:**
    - `node v4/tests/core.test.js` covers:
      - setup: v4 stands alone, both players get the same deck, the mulligan;
      - development Levels and snapshots;
      - Retain and the draw reduction;
      - Base Energy, Pass, Exert and Exhaust positions;
      - Ready and the unmatched-Speed Pass;
      - guards, Attack and trades;
      - both Recognition sources, and winning at 100.
    - `node v4/tools/layout.mjs` reports `layout: ok` at 1920×1080, 1366×768 and 1280×720.
  - **Art:** all existing; none missing for F1.

- **F2 — Locations (step 2 of 5).**
  - **Location Cards:**
    - **Place Location** is a Battle Phase action costing no Energy.
    - A Location covers 2, 3 or 4 adjacent free lanes (set per card) on both sides, including lanes with Pokémon already there.
    - It stays for a set number of Rounds (set per card), counted down at Supper. Then its lanes are the Default Location again, and Pokémon there stay where they are.
    - It can only be placed where enough adjacent free lanes exist; otherwise it says why.
  - **The four Locations:** each has a name, art, a passive on the Pokémon in it, and Weather of one type:

    | Location | Lanes | Rounds | Weather | Passive |
    |---|---|---|---|---|
    | Cerulean Cape | 2 | 3 | 1 Rain | +1 Strength |
    | Mt. Ember | 3 | 3 | 2 Sun | +1 Attack |
    | Lake of Rage | 2 | 2 | 1 Sun | Heal 2 at Breakfast |
    | Route 119 | 4 | 2 | 2 Rain | Summoning here costs 1 less |

    They're in the demo deck: 20 Pokémon plus the four Locations, the same list for both players.
  - **Weather:** Rain and Sun counts combine across all placed Locations. Brackets apply to both players:
    - **Rain 2:** every Pokémon heals 1 at Breakfast.
    - **Rain 4:** every Pokémon has +1 Strength.
    - **Sun 2:** Physical attacks deal +1 damage.
    - **Sun 4:** every Pokémon has +1 Attack.
  - **Dominance:** at Supper, for each placed Location, the player whose Pokémon there have the greater total current Strength earns +1 Recognition. Ties give nothing.
  - **The AI:**
    - It places Locations, valuing each one it dominates at the Recognition it would bring over the Rounds left.
    - It contests dominance, for example summoning into a Location you dominate.
    - It now only tries spaces it can pay for, since Route 119 makes cost depend on the lane.
  - **The interface:**
    - Locations are bold tiles in their own colour and art over their lanes on both sides.
    - Each has a compact panel with the name, Weather, Rounds left, who dominates now (with both Strength totals) and what that gives at Supper. The passive and details appear on hover.
    - The Default Location label sits over the widest stretch of Default lanes.
    - A Weather panel shows the Rain and Sun counts and which brackets are active.
    - Location cards in hand show their lanes, Rounds, passive and Weather.
    - **To place one:** select it, then click a glowing lane. It covers that lane and the ones to its right.
    - The Actions panel includes Place Location.
  - **Checks:**
    - `node v4/tests/locations.test.js` covers:
      - placement: widths, free lanes, over Pokémon, no room, no Energy;
      - duration and removal;
      - each passive;
      - the Weather brackets;
      - dominance and its Recognition, including ties;
      - the AI placing and contesting.
    - `core.test.js` still passes.
    - `layout.mjs` reports ok at all three sizes, with two new scenarios: placed Locations and choosing where to place one.
  - **Art:** all existing (cerulean-cape, mt-ember, lake-of-rage, route-119); none missing.

- **F3 — Command Cards and Supporters (step 3 of 5).**
  - **Command Cards:** three ways to play, each with its own Energy cost:
    - **Adapt** (a Battle Phase action): the standard effect, now.
    - **React:** cheaper and weaker.
      - It's played in response to the opponent committing an attack, a summon or an Adapt, and resolves before that action.
      - The window opens only if you can afford a React that has a target.
      - The committed action then resolves; it may fizzle, and its cost stays paid.
      - A React doesn't use a turn and can't be reacted to.
    - **Strat** (a Battle Phase action): dearer and stronger. Paid and targeted now; it resolves at the start of your next turn (or at Supper if the Battle Phase ends first), and fizzles if its target is gone.
  - **The four Command Cards:**

    | Card | Target | Adapt | React | Strat |
    |---|---|---|---|---|
    | Ember | an enemy Pokémon | 2 Energy: 3 damage | 1: 2 damage | 3: 5 damage |
    | Recover | one of yours | 2: heal 4 | 1: heal 2 | 3: heal 8 |
    | X Attack | one of yours | 2: +2 Attack until Supper | 1: +1 | 3: +4 |
    | Rock Slide | an enemy Pokémon | 3: 1 damage to each enemy Pokémon in its Location | 2: 1 damage to it | 4: 2 damage to each |

  - **Supporters** (a Battle Phase action, no Energy):
    - Release N other cards from hand. They go to the Released Pile for good and are never reshuffled. Then the Supporter is Released too.
    - **Favour:** if a Released card meets the condition, the enhanced effect applies and you earn +1 Recognition.

    | Supporter | Release | Effect | Favour: Release… | Enhanced |
    |---|---|---|---|---|
    | Nurse Joy | 1 | heal your Pokémon 2 | a Water Pokémon | heal 4 |
    | Professor Oak | 1 | search 1 Pokémon card | a Location | search 2 |
    | Brock | 2 | +1 Strength to your Pokémon | a Pokémon of Level 4+ | +2 |

  - **The demo deck:** 31 cards, the same for both players: the 20 Pokémon, the 4 Locations, the 4 Command Cards and the 3 Supporters.
  - **The AI:**
    - It plays Adapt and Strat.
    - It Reacts to the player when that helps, for example defeating an attacker before its attack.
    - It plays Supporters, Releasing its least useful cards or one that meets the Favour.
  - **The interface:**
    - **Command cards** show all three modes with their costs. Selecting one offers Adapt and Strat buttons, with costs and reasons when unaffordable. The targets then glow.
    - **The React window:**
      - The prompt bar describes the committed action, which is outlined on the board.
      - Command cards you can React with glow orange.
      - Pick one and a target, or press **Let it happen**.
      - While the Opponent decides on a React, you see that too.
    - **Pending Strats** show as badges on their target (blue for yours, orange for theirs), and in a Pending Strats panel with the effect.
    - **The Supporter screen:**
      - It marks which cards will be Released and which meet the Favour (★).
      - It says whether the Favour is met.
      - It enables the button only at the right count.
    - Released Pile counts are shown for both players, with the cards listed on hover.
    - The Actions panel includes Command and Supporter.
  - **Checks:**
    - `node v4/tests/commands.test.js` covers:
      - each Command mode;
      - React: the window opens only when affordable, resolves before the committed action (an attack, a summon or an Adapt), can make it fizzle with its cost still paid, uses no turn, and can't be reacted to;
      - Strat: resolves after the opponent's next turn or at Supper, and fizzles when its target is gone;
      - Supporters: Release is permanent and never reshuffled, the Supporter is Released too, and the Favour gives the enhanced effect and Recognition;
      - unaffordable or unavailable options are refused, with the reason;
      - the AI's React, Adapt and Strat choices.
    - `core.test.js` and `locations.test.js` still pass.
    - `layout.mjs` reports ok at all three sizes, with new scenarios: the Command chooser, a React window, pending Strats and the Supporter screen.
    - A browser click-through of Adapt, a Supporter and a React to a real AI attack showed no errors.
  - **Art:** all existing (ember, recover, x-attack, rock-slide, nurse-joy, professor-oak, brock); none missing.

- **F4 — Items and Trainers (step 4 of 5).**
  - **PokéDollars:**
    - +$1 at each Breakfast.
    - When an enemy Pokémon is defeated, its Energy cost at its Level (at least $1).
    - Carried between Rounds, and shown on both Player Characters.
  - **Items:** each has a price and is **Held** (attaches to one of your Pokémon, one each, lost when it is defeated) or **Consumed** (resolves, then goes to the PokéMart).

    | Item | Price | Type | Effect | Where |
    |---|---|---|---|---|
    | Potion | $2 | Consumed | heal 3 | deck and PokéMart |
    | Choice Band | $2 | Consumed | +2 Attack until Supper | deck and PokéMart |
    | Charcoal | $2 | Held | +1 Attack | deck and PokéMart |
    | Oran Berry | $1 | Consumed | heal 2 | PokéMart only |
    | Mystic Water | $2 | Held | +2 Strength | PokéMart only |
    | Leftovers | $3 | Held | heal 1 at each Breakfast | PokéMart only |

  - **Purchase Item** (a Battle Phase action):
    - Buy an Item from your hand or the PokéMart.
    - Then use it now, or store it in your Inventory Bag (6 spaces).
    - An unbought Item in hand is discarded at Supper.
  - **Play Inventory Item** (a Battle Phase action): use an Item from your Bag.
  - **The PokéMart:**
    - One shared pool with one copy of each Item.
    - At each Breakfast, unsold Items go back and 3 random Items go on sale.
    - Used and lost Items return to the pool.
  - **Trainer Cards**, two ways:
    - **Trainer Objective** (1 Energy):
      - It goes to your Trainer area and is tracked from then on; it isn't discarded at Supper.
      - **On completion:** its Partner arrives in your first empty space (or waits for one), its On Summon resolves, you earn +2 Recognition, and the Trainer is discarded.
    - **Trainer Command** (its own cost): resolves at once, then it's discarded.
  - **The two Trainers:**

    | Trainer | Objective | Partner (On Summon) | Trainer Command |
    |---|---|---|---|
    | Misty | Defeat 2 enemy Pokémon | Starmie (draw 2) | 1 Energy: draw 2 cards |
    | Blaine | Dominate a Location at Supper | Ninetales (1 damage to each enemy Pokémon) | 2 Energy: 1 damage to each enemy Pokémon |

  - **The demo deck:** 36 cards, the same for both players. Potion, Charcoal, Choice Band, Misty and Blaine are added.
  - **The AI:**
    - It buys Items from hand and the PokéMart, and uses them at once or stores them.
    - It uses Bag Items.
    - It plays Trainers as Objectives and as Trainer Commands.
  - **The interface:**
    - **PokéDollars:** a gold chip on each Player Character.
    - **Trainer areas** beside the Player Characters show each Trainer, its Objective, its progress (e.g. 1/2) and its Partner, plus any Partner waiting for a space.
    - **Partners** on the battlefield are marked ★ Partner, with a gold frame. Held Items show as a ◆ badge on their Pokémon.
    - **A strip under the battlefield** holds the PokéMart (3 Items with prices and Buy buttons, disabled with a reason on hover) and both Inventory Bags.
    - **Buying** offers *Buy & use now* or *Buy & store*, with reasons when unavailable. Usable Bag Items glow.
    - **Trainer cards** offer Objective and Command buttons with costs and reasons.
    - The Actions panel adds Purchase Item, Inventory Item, Trainer Objective and Trainer Command.
  - **Checks:**
    - `node v4/tests/items.test.js` covers:
      - income and defeat rewards;
      - buying from hand and from the PokéMart, used now or stored;
      - the Bag limit and playing from the Bag;
      - the PokéMart showing 3 each Breakfast, with unsold, used and lost Items returning to the pool;
      - Held and Consumed;
      - an unbought Item discarded at Supper;
      - Trainer Objective progress and completion, the Partner's arrival (including waiting for a free space), its On Summon and the Recognition;
      - Trainer Commands;
      - refusals with reasons;
      - the AI buying, using, and playing Trainers both ways.
    - The earlier tests still pass.
    - `layout.mjs` reports ok at all three sizes, with new scenarios: Items, Bags and Trainer areas; the buy chooser; the Trainer chooser.
    - A browser click-through showed no errors. It bought from the PokéMart and used it, bought from hand and stored it, used an Item from the Bag, and played a Trainer Objective and a Trainer Command.
  - **Art:** all existing (potion, oran-berry, choice-band, charcoal, mystic-water, leftovers, misty, starmie, blaine, ninetales); none missing.

- **F5 — the Pokémon League Tournament and completion (step 5 of 5).**
  - **The trigger:** at Breakfast at the start of Round 10, or at the first Breakfast where either player has 70+ Recognition, whichever comes first.
  - **The transition:**
    - All placed Locations are removed; their cards go to their owners' Discard Piles.
    - The Tournament covers all 9 lanes, and Pokémon stay where they are.
    - Location passives and Weather end.
    - No new Locations can be placed; Location cards say why.
    - It lasts until the match ends.
  - **Passive:** all Recognition earned is increased by half, rounded up (3 → 5).
  - **Dominance:** at each Supper, more total current Strength on the battlefield earns +3 Recognition (5 with the passive). Ties give nothing. It counts as dominating a Location for Blaine's Objective.
  - **Winning** stays at 100 Recognition; there's no other victory condition.
  - **The interface:**
    - A banner when the Tournament begins.
    - A gold Tournament tile across the board, showing its passive, who dominates (with both Strength totals) and what that gives at Supper.
    - A 🏆 Tournament chip by the Round.
    - The Weather panel shows "None".
  - **The AI** counts the Tournament's dominance.
  - **The final foundation deck:** 40 cards, adding a second Ember, Recover, Potion and Professor Oak. See "The foundation deck" above.
  - **`FOUNDATION_ASSUMPTIONS.md`** is completed in the section 13 format. Each entry gives what was chosen, why it's the simplest, and whether it needs approval. It covers the Tournament, the starting values, the round-start order, React timing and the Retain limit.
  - **Checks:**
    - `node v4/tests/tournament.test.js` covers:
      - the deck;
      - the trigger, by Round and by Recognition;
      - Locations removed and Pokémon staying;
      - old passives and Weather ending;
      - no Locations;
      - the +50% passive;
      - Tournament dominance and ties;
      - winning at 100 during the Tournament, for either player;
      - the AI.
    - All five test files pass.
    - The layout check is ok at all three sizes, with the Tournament banner and board scenarios.
    - Browser checks: a complete match against the AI, and a player win at 100. See "Validation" above.
  - **Missing art:** the Pokémon League Tournament has no art, so it uses a plain gold frame. Elliott, it needs a Tournament image (e.g. `assets/cards/pokemon-league.jpg`).

- **UX1 — Elliott's rule and display changes, and the React window** (`docs/v4-ux-plan.md`, sections 2 and 3.4).
  - **Trainer Objectives are active from the start** (a rule change Elliott settled):
    - The Trainers stay shuffled into the 40-card deck.
    - At setup, each player's Trainer area gets one Objective tracker per Trainer card in their deck (Misty and Blaine). Each is linked to its card's `uid`, active from Round 1, free, and starts at progress 0.
    - The Objective action is gone. A drawn Trainer is played only as its Trainer Command, then discarded, and keeps cycling; the Command doesn't affect its Objective.
    - **On completion:**
      - the Trainer card is taken at once from the Draw Pile, the hand (Retained or not) or the Discard Pile, and leaves the deck for good (39 cards left);
      - its Partner arrives (or waits for a free space);
      - its On Summon resolves;
      - +2 Recognition.
    - The tracker stays, ticked. Progress, completion and where the card was taken from are logged.
    - The AI never plays an Objective.
  - **Command modes by situation:** a pure engine helper, `commandModesFor(s, who, uid)`. The hand display, the click menu and the AI all use it.
    - **Your turn:** Adapt (with its reason if it can't be played), plus Strat only if you can afford it.
    - **Your React window:** React only, if affordable with a target.
    - **Otherwise:** none, and the card is quietly dimmed.
  - **The React window** (when it's your React):
    - **The pause:** everything else stops.
    - **The committed action:** shown on the board, with a dashed arrow from the attacker (or from the banner, for an Adapt) to its target, or the incoming summoned card in its space.
    - **The banner:** a REACT? banner with a plain sentence (e.g. "The Opponent's Gyarados is attacking your Charizard for 9.") and a countdown bar.
    - **The options:** each playable React card shown large, with its effect aimed at the actual target, its cost, the Energy you'll have left, and a React button. A card with several targets highlights them first.
    - **Let it happen.**
    - **The timer:** 5 s by default. A small React timer control (5, 8, 12 or 20 s) is under the build line, saved in localStorage (inside try/catch). On timeout it sends the same `decline` as the button.
    - **Keys:** Space reacts when there's exactly one option and one target; Esc lets it happen.
    - The timer lives in `main.js`, not the engine. The AI's React decisions are instant, and autoplay and tests never wait.
  - **Series hidden:** Light, Mid and Heavy no longer appear in any displayed text (card faces, the hand line, board cards, hover and detail text, the log). They stay in the data and rules.
  - **Recognition** is shown capped at 100 everywhere on screen. The end screen also gives the real totals.
  - **Checks:**
    - `node v4/tests/ux1.test.js` covers:
      - 2 active Objectives at progress 0 and 40 cards at setup;
      - no `trainerObjective` action;
      - a Trainer played only as a Command and cycling;
      - completion from the Draw Pile, the hand (Retained) and the Discard Pile (39 left, the Partner, +2, a ticked tracker that makes no more progress);
      - `commandModesFor` in every situation;
      - `decline` resolving the committed attack;
      - no series in rendered text or the log;
      - Recognition capped on screen.
    - The other five test files were updated where they used the Objective action, or where always-active Objectives would change what they check. They all pass.
    - `layout.mjs` is ok at all three sizes.
    - **A browser check of the real React window** (opened by an AI attack): the timer declines after 5 s, Esc lets it happen, Space reacts, a multi-target React highlights its targets, and the timer setting survives a reload. No errors.

- **UX2 — Objective targets, stronger Partners, and the new layout, HUD and card faces** (`docs/v4-ux-plan.md` 2b, 3.1, 3.3, Q5–Q8; the mockup `docs/design/v4-ux2-layout-mockup.jpg`/`.html`; the stat icons `docs/design/v4-stat-icons`).
  - **Numbers Elliott approved:**
    - **Misty:** "Defeat 8 enemy Pokémon".
    - **Blaine:** "Dominate a Location 5 times". Each Location dominated at a Supper counts 1, and so does the Tournament.
    - **Starmie** (Partner): Level 8, Swift, Special Attack 8, Hitpoints 10, cost 4. On Summon: draw 2.
    - **Ninetales** (Partner): Level 8, Steady, Special Attack 9, Hitpoints 11, cost 4. On Summon: 2 damage to each enemy Pokémon.
    - A defeated Partner gives $4.
  - **The layout** (a fixed 1920×1080 stage, matching the mockup):
    - **The prompt bar:** the only place for step text and action buttons. Hover its text for every action and why it's unavailable (the old Actions panel).
    - **The opponent's HUD:**
      - a Recognition ring, capped at 100 on screen, which is also the attack target for the Player Character;
      - purse, Energy and Exert line, and 6 Bag slots;
      - two Objective trackers: art, name, short goal, one pip per step, the Partner's thumbnail, and green with a tick when complete;
      - hand backs with a count, the Released count, and the Deck and Discard piles.
    - **The board:**
      - Locations are full tiles: art over all their lanes on both rows, a coloured border, Pokémon standing on the art.
      - Each Location has a plate showing name, passive, Rounds-left pips, the Weather it adds, "N vs M" Strength, and a two-colour bar.
      - The Tournament is one tile with its plate (×1.5, dominance +3).
      - Empty lanes are plain mat, and the "Default Location" label is gone.
    - **Board cards:**
      - Level chip (★ and a Partner chip for Partners), a round Held Item chip, and a stat bar: attack icon and Attack, Speed chevrons, Strength icon and current Strength (red when damaged). No Def or Sp.Def tags.
      - **Ready:** a pulsing gold glow, static under `prefers-reduced-motion`.
      - **Spent:** greyed and tilted −6°.
      - **Legal attack targets:** a red ring. A guarded Pokémon is dimmed and says "Guarded by X".
    - **The five stat icons** live in `src/ui/icons.js`: Physical and Special Attack; Hitpoints, Defence and Special Defence. `attackIcon(card)` and `strengthIcon(card)` are pure helpers, used on board and hand cards and in the log. Tooltips name the stat in words.
    - **The right column:**
      - Round, with when the Tournament comes;
      - one Weather chip: totals, the active bracket effect and the next bracket;
      - the Energy tile: Base Energy left, "of N this turn", Exert diamonds (ready, Exhausted, locked) and return Rounds;
      - END TURN;
      - the PokéMart button with an "N new" badge after each Breakfast. It opens a drawer with the 3 Items and Buy buttons (same buying as before; reasons on hover).
      - the log ticker: the last 3 lines, coloured by player, with attack icons. It and the L key open the full log drawer.
    - **Your HUD:** ring, purse, Bag (click a usable Item to use it) and your two Objective trackers.
    - **The hand:** 182×254 cards, fanned and overlapping, lifting to the front on hover.
      - **Cost gem:** blue for Energy, gold $ for Items, red when unaffordable. Locations and Supporters have none.
      - **Faces:** Pokémon show a Level chip, a Type icon before the name, one rules line and a stat bar. Other cards show a kind line. Commands show only the `commandModesFor` modes as chips.
      - Playable cards have a gold edge; unplayable ones are dimmed, with the reason on hover.
    - **Bottom-right:** your Deck and Discard piles, the key hints (with the React timer setting), and the Released and Retained counts.
    - **Removed:** the Actions panel, the pile-count panel, the strip under the board, the Weather bracket list and the "Default Location" label. Their facts are now on the HUDs, piles, tooltips and the prompt bar.
  - **Kept:** UX1's React window (banner, arrow, large React cards, timer, keys), the mulligan, the end screen, the Supporter Release choice, Item targeting and the Tournament banner.
  - **Checks:**
    - `node v4/tests/ux2.test.js` covers:
      - the Objective targets and texts;
      - the Partners' stats, On Summon and $4;
      - Blaine's per-Location counting, including the Tournament;
      - the five icons;
      - no cost gem on a Location;
      - no series in any rendered text.
    - All seven test files pass. Earlier tests were updated where they assumed Objective targets of 2 and 1.
    - `layout.mjs` is ok for all 19 scenarios at 1920×1080, 1366×768 and 1280×720, including the new PokéMart drawer and log drawer scenarios.
    - **Browser click-through of every action in the new layout:**
      - the mulligan and summon;
      - attacking a Pokémon and the Player Character;
      - Command Adapt and Strat;
      - a Supporter Release and placing a Location;
      - buying from the PokéMart drawer and from hand, and using a Bag Item;
      - a Trainer Command, Retain and End turn;
      - the log drawer by click and by L, and the PokéMart drawer.

      There were no errors, and the UX1 React window check still passes.

- **UX3 — interaction (drag and drop, targeting arrows with previews, keyboard, confirmations) and UX2 polish** (`docs/v4-ux-plan.md` 3.4; the mockup's arrow and preview).
  - **Result previews** (`src/engine/preview.js`, pure). Each one plays the action on a copy of the state with the engine's own functions, so it can never disagree with the result.
    - **`attackPreview(s, who, from, target)`** returns:
      - the damage, and the target's Strength before and after;
      - a defeat and its rewards (Recognition after the Tournament's ×1.5, and $), or Recognition from damage to a Player Character;
      - the hit-back from a Ready target: its damage, the attacker's Strength after, a defeat, and the opponent's rewards;
      - the parts of the attack number (base Attack, Location, Weather, Held Item, "until Supper", Sun 2 for Physical), which always add up to the engine's damage.
    - **`effectPreview(s, who, card, mode, target)`** does the same for every Command mode, Items and Trainer Commands. Damage and heals show before → after, plus defeats and rewards. Effects with no number (such as "Draw 2 cards") give a sentence.
  - **Targeting arrows and previews** (`src/ui/interact.js`, on a layer above the board and below dialogs):
    - **The arrow** is curved, glowing and dotted, from the attacker or the hand, Bag or React card to the pointer. It turns red and snaps onto a legal target.
    - **The preview panel** sits beside the target: the title, stat icons with before → after, the breakdown ("9 = 8 Attack + 1 Mt. Ember"), gain chips ("Defeats it · +2 Recognition", "+$4"), and a hit-back line when the target is Ready.
    - **Illegal places** show their reason, such as "Guarded by Arcanine".
    - **Summoning and placing a Location:** the legal lanes glow, and hovering shows the cost (with the Route 119 discount), or the Location's outline over the lanes it would cover.
  - **Drag and drop** (pointer events, no library):
    - **From the hand:** a Pokémon to an empty space; a Location to a lane on either row (that lane is its start); a Command or Item to a legal target; a Supporter or Trainer Command to anywhere on the board.
    - **From the board:** a Ready Pokémon to an enemy Pokémon or the Opponent's Recognition ring.
    - **From the Bag:** an Item to one of your Pokémon.
    - **While dragging,** the card follows the pointer at 85% size and legal drops glow.
    - **A Command with two playable modes** opens a mode picker at the drop, showing each mode with its effect and cost.
    - **Cancelling:** an illegal drop, Esc or right-click cancels, and the card glides back. Nothing is committed before a legal drop.
    - Clicking works as before; every click, drop and Enter goes through the same flow (`src/ui/flows.js`).
  - **Keyboard:**
    - **Space:** End turn. **1–9:** select a hand card. **A:** select an attacker; press again for the next one. **R:** Retain the selected card.
    - **Tab / Shift+Tab:** cycle legal targets or spaces, with the preview and a focus ring. **Enter:** confirm.
    - **Esc or right-click:** cancel. **L:** the log. **?:** the key list.
    - Keys do nothing under a dialog with its own keys: the React window, the mulligan, the Release choice, the Tournament banner, a confirmation or the key list. Those keep their own keys (Enter or Esc where they have them).
    - The key hint at the bottom-right and END TURN's Space keycap are updated.
  - **Confirmations,** each with "Don't ask again" (kept in localStorage inside try/catch):
    - "End turn with N Energy unused?", when you have Energy and a playable card;
    - "Release N cards? Released cards leave the match.";
    - Retaining your last card.
  - **Polish:**
    - The log ticker's lines are trimmed in JS to fit.
    - The Weather chip's lines fit, including in the Tournament.
    - The Round panel's Tournament chips fit.
    - The opponent's pile counts sit inside the piles, clear of the captions.
    - Tall display numbers no longer overflow their boxes.
    - Text selection is off while dragging.
  - **An engine bug the new tests found:** the React-window event put `type: pending.type` in its data, which overwrote the event's own type. So a React window was logged as an "attack" event, and an earlier test of "no window" passed trivially. It's renamed `action`.
  - **The layout check** now also fails when any text overflows its own box. It has new scenarios: an attack preview with a hit-back, a Command drag over a target, the mode picker, a Location placement preview, the key list and a confirmation.
  - **Checks:**
    - **`node v4/tests/ux3.test.js`:** 220 random legal attacks from AI-played matches (fixed seeds) agree with `applyAction`. It compares damage, both Strengths, defeats, Recognition and $ for both players, with Location, Weather, Held Item, Tournament, hit-back, Player Character and defeat cases all covered. 63 effect cases (every Command mode, every Item, both Trainer Commands, and a Tournament defeat) agree with the real results.
    - All eight test files pass.
    - The layout check is ok at all three sizes.
    - **The Playwright browser check:**
      - drags to summon, to place a Location, to attack (a Pokémon and the ring), to play a Command through the mode picker, and to use Items from the hand and the Bag;
      - Esc and right-click cancel a drag;
      - one turn with keys only (1, Tab, Enter; A, Tab, Enter; Space with its confirmation);
      - each confirmation and its "Don't ask again";
      - the key list.

      No page errors.
- **UX4 — motion and effects** (`docs/v4-ux-plan.md` 3.5, `docs/vfx.md`). No rule or number changed.
  - **Reused, copied into v4 (each with a "Copied from …" header):**
    - `src/ui/vfx/gl.js`, `timeline.js`, `textures.js` and `shared.js` (the root effects library), from `src/ui/vfx/`;
    - `src/ui/vfx/engine.js` and `src/ui/particles.js`, from v2.
    - v4's changes are small: local imports; low motion follows v4's setting; textures load from `../assets/vfx/`; the board shake moves `.v4-board`; one frame may advance up to 100 ms, so a slow GPU stays near real time.
  - **The presenter** (`src/ui/plan.js`, pure; `src/ui/present.js`, the page):
    - Each action plays beat by beat. First the action on the board as it was; then the new state is drawn (at the first arrival); then the arrivals.
    - A Pokémon defeated after the new board is drawn keeps a ghost card, so its defeat still plays.
    - Input is locked while a beat plays. A click, Space or Esc skips to the end of the action.
    - The presenter only reads `prev` and `next`. `main.js` sets the state once, when it draws.
    - Without WebGL (`?nowebgl` forces it), 2D particles stand in; numbers, banners and card moves still play.
  - **The library** (`src/ui/vfx/library.js`, data only):
    - **`EVENT_BEATS`:** each of the 33 engine event types has a beat, a budget and a sound hook.
    - **Attacks:** Fire Physical is Flame Wheel; Fire Special is Flamethrower; Water Physical is Waterfall; Water Special is Hydro Pump; Electric Special is forked lightning (the shared bolt plus a second fork).
    - **Commands:** Ember and Rock Slide use v1's Strategy animations; Recover and X Attack are composed from the shared presets. React is quick, Adapt standard, Strat big.
    - v4's own moments, and `MS`: every page-animation time at Normal.
  - **Engine data fields** (data only; the engine does the same):
    - `hits` (each Pokémon's Strength and Attack before and after, and defeats) on Commands, Items, Supporters, Trainer Commands, On Summons and Breakfast heals;
    - `from` (the source) on Recognition and $;
    - names and uids on several events;
    - a Breakfast `summary` (cards drawn, $, Base Energy);
    - `emit` now returns its event.
  - **The beats:**
    - **Attacks:** hit-stop, shake and bloom scale with the damage; damage numbers; Strength numbers tick down. A hit-back plays the defender's shorter counter. An attack on the Player Character hits the Recognition ring.
    - **Heals:** green motes and "+N". **Defeats:** the card dissolves (ash, wash or shatter, by the Type that defeated it), then coins fly to the purse and "+N" flies to the ring.
    - **Commands:** the card rises to centre stage, flares and resolves at its target. X Attack leaves an aura on its Pokémon until Supper.
    - **Strats:** a played Strat flies to its owner's board edge and stays there, sealed: a glowing card back with an hourglass. When it resolves, it rises from there. A React plays inside the React-window flow.
    - **Summons** drop in with dust and glow, bigger by Level, then their On Summon. Charizard's and Ninetales's damage uses their own attack animation.
    - **Partners** (about 2 s): the tracker bursts, the Trainer's art sweeps across, the Partner lands with a gold shockwave, then its On Summon.
    - **Objectives:** each step fills the next pip with a pulse; completion turns the tracker green with a flare.
    - **Recognition:** "+N" flies from its source to the ring, and the ring fills smoothly. In the Tournament it reads "+2 → +3". The ring flares at 50, 70 and 90 and stays capped at 100.
    - **PokéDollars and Items:** coins fly to the purse. A purchase flies the Item from the PokéMart or the hand to the Bag. Using an Item plays a small effect on its target.
    - **Supporters:** the Released cards burn away, then the effect, then "Favour!" and its Recognition.
    - **Locations:** a new one unfolds over its lanes and an expiring one folds away. Retaining a card shows a small lock.
    - **Weather:** ambient rain or sun while a bracket of 2+ is active (CSS transforms; off in low motion). The Weather chip pulses and names a bracket when it is reached.
    - **Supper:** the Strats resolve; each dominated Location's plate glows on the winner's side, then its Recognition flies; then Objective progress; then the countdowns; then the hand slides to the Discard Pile, and Retained cards stay.
    - **Breakfast:** "Round N", a summary strip, then the new hand deals in.
    - **Banners:** "Round N", "Your turn", "Opponent's turn" and "Supper", each 0.7 s at Normal.
    - **The Tournament:** a stadium sweep across all 9 lanes, then the existing banner; closing the banner stamps "×1.5" on each ring.
    - **The end of the match:** the winner's ring fills and flares "Champion", then the end screen. The end screen and the Tournament banner wait for the beats.
  - **AI pacing:** a thinking pause (0.5 s at Normal) with "The Opponent is thinking…" in the prompt bar. Then the prompt bar names the action, and anything with a target gets the arrow from its source to its target for 0.4 s, before the beat.
  - **Speed:** Slow, Normal, Fast and Instant (×1.5, ×1, ×0.5, none), plus a Low motion toggle, beside the React timer. Both are kept in localStorage inside try/catch.
    - Low motion is on by default under the OS's reduced-motion setting. It means fewer particles, no shake, no distortion and no ambient Weather.
    - `?autoplay` uses Fast. The layout tool uses `?speed=instant`.
    - `?timescale=N` (checks only) stretches every beat, so a slow renderer can be screenshotted mid-beat.
  - **Sound hooks:** `sfx(name, opts)` in `src/ui/sound.js` is a no-op, called at every beat. The calls are kept for `?debug` checks.
  - **Performance:** the WebGL loop runs only while an effect is alive. With nothing playing, a frame takes 16.7 ms (60 fps), with WebGL or without. Textures load once from `assets/vfx/manifest.json`. All 25 are present, so no placeholders were drawn.
  - **Polish:**
    - The log ticker trims each line by measured width: canvas `measureText` with a binary search, in the font the browser actually uses.
    - A bug where a new match could leave the AI loop stopped is fixed. It happened when the old loop was still waiting, because the new loop was refused.
  - **Checks:**
    - **`node v4/tests/ux4.test.js`** checks, without a browser:
      - every event type in 30 fixed-seed AI-vs-AI matches has a beat;
      - every attack combination maps to an animation, and the five named ones are right;
      - every Command card and mode, Supporter, Item and Trainer Command has an effect;
      - every timeline, moment and planned beat is within its vfx.md budget at Normal;
      - a seeded match ends in the same state planned at Instant or Normal.
    - **`node v4/tools/ux4check.mjs`** runs in the browser:
      - a seeded match at Normal for 3 Rounds;
      - frame times;
      - click-to-skip, Instant, low motion and the no-WebGL fallback;
      - the mid-beat screenshots.
    - **Results:**
      - all nine test files pass, `ux4` with 14,498 checks;
      - the layout check is ok at all three sizes, at Instant;
      - `ux4check` passes 11 of 11: 3 Rounds at Normal in 166 s with no page errors; click-to-skip draws the new state in 78 ms.
      - **Frame times** were measured in headless Chromium, which renders WebGL in software, not on a GPU:
        - over the 3-Round match: 27.6 ms average, 233 ms worst;
        - during the Supper → Breakfast → Tournament beat: 25.9 ms average, 183 ms worst;
        - during a Flamethrower with a hit-back: 125.8 ms average, 217 ms worst;
        - idle: 16.7 ms.

        60 fps on integrated graphics still needs checking on a real machine.
- **G1 — rules and economy** (`docs/v4-gameplay-update.md` sections 1, 2 and 7, approved by Elliott on 10 November 2026). The deck is unchanged; G2 and G3 rebuild it.
  - **Pass (2.1):** you can't Pass while a Ready Pokémon of yours with unmatched Speed has a legal target. This includes the Pass that would end the Battle Phase.
    - End turn is disabled and shows the reason, e.g. "Charizard is Ready and faster than anything the Opponent has: attack first"; Space does nothing then.
    - The prompt bar says why End turn waits. The UX3 end-turn confirmation can't offer an illegal Pass.
    - The AI plays through `legalActions`.
    - The no-target case can't arise with today's guards (a guard is always itself a target). `passBlockers` and `passReason` take an optional target check so the test can stage it.
  - **React (2.2):** a React window opens only for an attack, an Adapt when it's played, and a Strat as it resolves, at the start of its owner's next turn or at Supper.
    - No window opens for summons, a Strat played face-down, or Trainer Commands.
    - At Supper the window opens before dominance, and Supper goes on once it closes.
    - A resolving Strat isn't a turn. A React that removes its target makes it fizzle.
    - The interface's React window (banner, timer, keys) works for it. Its arrow starts at the Strat's sealed card, which glows on its owner's board edge until it resolves.
  - **Costs (2.3):** `costFor(level) = ceil(level / 2)`: Level 1–2 cost 1, 3–4 cost 2, 5–6 cost 3, 7–8 cost 4. Nothing is free; Partners stay cost 4.
  - **Recognition (2.4):** dominating a Location +3, a Favour +3, dominating the Tournament +5 (8 with its passive).
  - **PokéDollars (2.5):** +$1 at each Breakfast, plus a flat +$1 for each enemy Pokémon defeated, Partners included.
  - **The PokéMart (2.6):**
    - **The rules:**
      - One Item is on sale, with its Stock: Oran Berry $1, 8 turns; Potion, Choice Band, Charcoal and Mystic Water $2, 6 turns; Leftovers $3, 4 turns.
      - Each turn by either player in the Battle Phase uses 1 Stock. At 0 a different random Item from the pool replaces it, with full Stock.
      - Stock carries across Breakfast; there's no refresh.
      - Once bought, it's Sold out until the buyer has finished their next turn, and nothing counts down meanwhile.
    - **The interface:**
      - The button, drawer and "N new" badge are gone.
      - A small card in the right-hand column shows the Item's art, name, price gem, Held or Consumed, its effect, and a Stock pip per turn left (the last one pulsing).
      - Buy leads to the existing use-or-store choice, with the reason when you can't buy.
      - Sold out shows a stamp and "Restocks after your/the Opponent's next turn". A new Item slides in with a short beat.
      - The log ticker shrank to two lines to make room.
    - **The AI** gives a small bonus to buying it, because that takes it away from the opponent.
  - **Trainer Objective point moments (2.7):** a new presenter beat for each `objectiveProgress`, for either player:
    - A dark backdrop fades in, and the Trainer's portrait slides in large from that player's side, with the name and the Objective.
    - Below it is a track of pips with the Partner's portrait at the end. The new pip stamps in with a flash and a rising "+1", the count ticks ("3 → 4 / 8"), and the Partner glows a step brighter.
    - Then the portrait slides back into the tracker, which pulses.
    - It takes about 1.2 s at Normal. Several points in one action play as one moment.
    - The final point plays a longer version (the track fills and the portrait flares gold), leading straight into the Partner's arrival.
    - It follows the speed setting and is skippable. Low motion keeps the stamp and the count but drops the movement.
  - **Docs:** `FOUNDATION_ASSUMPTIONS.md` is updated for every rule here, including the Breakfast order (no PokéMart refresh), the Supper order, and the Pass and React sections. The hint and reason texts are updated too.
  - **Checks:**
    - **`node v4/tests/g1.test.js`** checks Pass, the React windows, costs, Recognition and $, the PokéMart's Stock, replacement, carry-over and Sold out, and the Objective beat.
    - The existing tests were updated for the new values: costs, $ per defeat, Favour, dominance and the Tournament; summons can't be Reacted to; a resolving Strat opens a window; the one-slot PokéMart. Their time-advancing Pass helpers make a blocking Pokémon Spent first.
    - The layout check has new scenarios: the PokéMart card, a long Item text, Sold out, End turn blocked, an Objective moment mid-beat, the final point, and a React window on a resolving Strat. The mart drawer scenario is gone.
    - `node v4/tools/sim-g1.mjs` runs the 100-match AI-vs-AI summary.
